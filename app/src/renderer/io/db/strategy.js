import { runSelectDB, runInsertUpdateDeleteDB } from '__gUtils/dbUtils';
import { buildDateRange } from '@/assets/js/utils';

import {
    STRATEGYS_DB, 
    buildAccountOrdersDBPath,
    buildStrategyPosDBPath,
    buildStrategySnapshortsDBPath,
    buildAccountTradesDBPath
} from '__gConfig/pathConfig';
import moment from "moment"

/**
 * 获取策略列表
 */
export const getStrategyList = () => {
    return runSelectDB(STRATEGYS_DB, 'SELECT * FROM strategys')
}

/**
 * 获取策略by id
 * @param  {string} id
 */
export const getStrategyById = (id) => {
    return runSelectDB(STRATEGYS_DB, "SELECT * FROM strategys WHERE strategy_id = ?", id)
}

/**
 * 新建策略
 * @param {String} id 交易任务名 
 */

export const addStrategy = (strategy_id, strategy_path) => {
    const addTime = +new Date().getTime() * Math.pow(10,6)
    return runInsertUpdateDeleteDB(STRATEGYS_DB, 'INSERT INTO strategys(strategy_id, strategy_path, add_time) VALUES (?, ?, ?)', [strategy_id, strategy_path || null, addTime])
}

/**
 * 删除策略
 * @param  {} strategy_id
 */
export const deleteStrategy = (strategy_id) => {
    return runInsertUpdateDeleteDB(STRATEGYS_DB, "DELETE FROM strategys WHERE strategy_id = ?", strategy_id)
}
 
/**
 * 更改策略路径
 * @param  {String} strategy_id
 * @param  {String} strategy_path
 */
export const updateStrategyPath = (strategy_id, strategy_path) => {
    return runInsertUpdateDeleteDB(STRATEGYS_DB, 'UPDATE strategys SET strategy_path = ? WHERE strategy_id = ?', [strategy_path, strategy_id])    
}


/**
 * 获取某策略下委托
 */
export const getStrategyOrder = async(strategyId, {id, dateRange}, tradingDay) => {
    //新建与之前重名策略，防止get之前的数据
    const strategys = await getStrategyById(strategyId)
    if(!strategys[0]) throw new Error('找不到该策略！');
    const strategyAddTime = strategys[0].add_time;
    const filterDate = buildDateRange(dateRange, tradingDay, strategyAddTime)    
    return new Promise((resolve, reject) => {
        let tableData = []
            accounts = [];
            throw new Error('这块要重写!')
            if(accounts.length == 0) resolve([]);
            //todo: accountid 不清楚
            const promises = accounts.map(item => 
                    (runSelectDB(buildAccountOrdersDBPath(
                        undefined,
                        item.account_id), 
                        `SELECT * FROM orders WHERE client_id = '${strategyId}'` + 
                        ` AND (order_id LIKE '%${id || ''}%' OR instrument_id LIKE '%${id || ''}%' OR client_id LIKE '%${id || ''}%')` + //有id筛选的时候
                        ` AND insert_time >= ${filterDate[0]} AND insert_time < ${filterDate[1]}` +
                        (dateRange.length ? `` : ` AND status NOT IN (3,4,5,6)`) //有日期筛选的时候,获取所有状态的数据；无日期的时候，获取的是当天的且未完成的
                    ).then(orders => tableData = tableData.concat(orders)))
            )
            //用这种方式处理map+promise
            Promise.all(promises).then(() => {
                //对整体排序，默认的只是账户1排序后面跟着账户2的排序，需要的是整体的排序
                tableData.sort((a, b) => b.insert_time - a.insert_time)
                resolve(tableData)
            })
      

    })
}

/**
 * 获取某策略下成交
 */
export const getStrategyTrade = async(strategyId, { id, dateRange }, tradingDay) => {
    //新建与之前重名策略，防止get之前的数据    
    const strategys = await getStrategyById(strategyId)
    if(!strategys[0]) throw new Error('找不到该策咯！');
    const strategyAddTime = strategys[0].add_time;
    const filterDate = buildDateRange(dateRange, tradingDay, strategyAddTime)
    return new Promise((resolve, reject) => {
        getStrategyAccounts(strategyId).then(accounts => {
            let tableData = [];
            const promises = accounts.map(item => runSelectDB(
                buildAccountTradesDBPath(item.account_id), 
                `SELECT rowId, * FROM trade WHERE client_id = '${strategyId}'` + 
                ` AND (instrument_id LIKE '%${id || ''}%' OR client_id LIKE '%${id}%')` + //有id筛选的时候
                ` AND trade_time >= ${filterDate[0]} AND trade_time < ${filterDate[1]}`
            ).then(trade => tableData = tableData.concat(trade)))
            Promise.all(promises)
            .then(() => {
                tableData.sort((a, b) => b.trade_time - a.trade_time)
                resolve(tableData)
            }).catch(err => reject(err))
        }).catch(err => {
            reject(err)
        })
    })
}

/**
 * 获取某策略下的持仓
 */
export const getStrategyPos = (strategyId, {instrumentId, type}) => {
    return new Promise((resolve, reject) => {
        runSelectDB(buildStrategyPosDBPath(strategyId), `SELECT * FROM position where instrument_id LIKE '%${instrumentId || ''}%'` + (type ? ` AND instrument_type = ${type}` : ``) + ' ORDER BY instrument_id')
        .then(pos => {
            let posList = {}
            //策略的pos是一条一条成交记录？
            pos.map(item => {
                let key = item.instrument_id + item.direction
                if(posList[key]) {
                    posList[key].yesterday_volume = posList[key].yesterday_volume + item.yesterday_volume
                    posList[key].volume = posList[key].volume + item.volume
                    posList[key].last_price = posList[key].last_price + item.last_price
                    posList[key].margin = posList[key].margin + item.margin
                }else{
                    posList[key] = item
                }
            })
            resolve(Object.values(posList))
        }).catch(err => {
            reject(err)
        })
    }) 
}

/**
 * 获取某策略下收益曲线分钟线
 */
export const getStrategyPnlMin = (strategyId, tradingDay) => {
    if(!tradingDay) throw new Error('无交易日！')
    return runSelectDB(buildStrategySnapshortsDBPath(strategyId), `SELECT * FROM portfolio_1m_snapshots WHERE trading_day = '${tradingDay}'`)
}


export const getStrategysPnl = (ids, tradingDay) => {
    if(!tradingDay) throw new Error('无交易日！')
    const promises = ids.map(id => getStrategyPnlMin(id, tradingDay).then(res => {
        const resLen = Object.keys(res || {}).length;
        let lastIndex = 0;
        if(resLen > 0) lastIndex = resLen - 1;
        return {lastPnl: res[lastIndex], strategyId: id}
    }))
    return Promise.all(promises)
}


/**
 * 获取某策略下收益曲线日线
 */
export const getStrategyPnlDay = (strategyId) => {
    return runSelectDB(buildStrategySnapshortsDBPath(strategyId), 'SELECT * FROM portfolio_1d_snapshots')
}



