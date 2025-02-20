//
// Created by Keren Dong on 2019-06-20.
//

#ifndef WINGCHUN_CONTEXT_H
#define WINGCHUN_CONTEXT_H

#include <kungfu/practice/apprentice.h>

#include <kungfu/wingchun/msg.h>
#include <kungfu/wingchun/calendar/calendar.h>

namespace kungfu
{
    namespace wingchun
    {
        namespace strategy
        {
            class Runner;

            inline uint32_t get_symbol_id(const std::string &symbol, const std::string &exchange)
            {
                return yijinjing::util::hash_str_32(symbol) ^ yijinjing::util::hash_str_32(exchange);
            }

            class Context
            {
            public:
                explicit Context(practice::apprentice &app, const rx::observable<yijinjing::event_ptr> &events);

                ~Context() = default;

                //获取当前纳秒时间
                //@return            当前纳秒时间
                int64_t now() const;

                //添加策略使用的交易账户
                //@param source_id   柜台ID
                //@param account_id  账户ID
                //@param cash_limit  可用资金限制
                //@return            成功或者失败
                void add_account(const std::string &source, const std::string &account, double cash_limit);

                //订阅行情
                //@param source_id   柜台ID
                //@param instruments 合约列表
                //@param exchange_id 交易所ID
                //@param is_level2   是否订阅Level2数据
                void subscribe(const std::string &source, const std::vector<std::string> &instruments, const std::string &exchange = "");

                //限价单报单
                //@param instrument_id 合约ID
                //@param exchange_id   交易所ID
                //@param account_id    账户ID
                //@param limit_price   价格
                //@param volume        数量
                //@param side          买卖方向
                //@param offset        开平方向
                //@return              订单ID
                uint64_t insert_limit_order(const std::string &symbol, const std::string &exchange, const std::string &account,
                                            double limit_price, int64_t volume, Side side, Offset offset);

                //fok单报单
                //@param instrument_id 合约ID
                //@param exchange_id   交易所ID
                //@param account_id    账户ID
                //@param limit_price   价格
                //@param volume        数量
                //@param side          买卖方向
                //@param offset        开平方向
                //@return              订单ID
                uint64_t insert_fok_order(const std::string &symbol, const std::string &exchange, const std::string &account,
                                          double limit_price, int64_t volume, Side side, Offset offset);

                //fak单报单
                //@param instrument_id 合约ID
                //@param exchange_id   交易所ID
                //@param account_id    账户ID
                //@param limit_price   价格
                //@param volume        数量
                //@param side          买卖方向
                //@param offset        开平方向
                //@return              订单ID
                uint64_t insert_fak_order(const std::string &symbol, const std::string &exchange, const std::string &account,
                                          double limit_price, int64_t volume, Side side, Offset offset);

                //市价单报单
                //@param instrument_id 合约ID
                //@param exchange_id   交易所ID
                //@param account_id    账户ID
                //@param volume        数量
                //@param side          买卖方向
                //@param offset        开平方向
                //@return              订单ID
                uint64_t insert_market_order(const std::string &symbol, const std::string &exchange, const std::string &account,
                                             int64_t volume, Side side, Offset offset);

                //撤单
                //@param order_id      订单ID
                //@return              撤单操作ID
                uint64_t cancel_order(uint64_t order_id);

            protected:
                void react(const rx::observable<yijinjing::event_ptr>& events);

            private:
                uint32_t lookup_account_location_id(const std::string &account);

                void request_subscribe(uint32_t source, const std::vector<std::string> &symbols, const std::string &exchange);

            private:
                practice::apprentice& app_;
                const rx::observable<yijinjing::event_ptr> &events_;
                int64_t now_;

                Calendar_ptr calendar_;

                std::unordered_map<uint32_t, uint32_t> account_location_ids_;
                std::unordered_map<uint32_t, msg::data::AccountInfo> accounts_;
                std::unordered_map<uint32_t, msg::data::Quote> quotes_;

                std::unordered_map<std::string, uint32_t> market_data_;

                friend class Runner;
            };
            DECLARE_PTR(Context)
        }
    }
}

#endif //WINGCHUN_CONTEXT_H
