odoo.define("pos_orders_all.pos_models", function(require) {
    "use strict";

    var models = require("point_of_sale.models");
    var screens = require("point_of_sale.screens");
    var core = require("web.core");
    var gui = require("point_of_sale.gui");
    var popups = require("point_of_sale.popups");
    var QWeb = core.qweb;
    var rpc = require("web.rpc");

    var _t = core._t;

    // Load Models
    models.load_models({
        model: "sale.order",
        fields: [
            "name",
            "partner_id",
            "confirmation_date",
            "user_id",
            "amount_untaxed",
            "order_line",
            "session_id",
            "amount_tax",
            "amount_total",
            "company_id",
            "date_order",
            "amount_remaining",
            "amount_remaining_untaxed",
        ],
        domain: [["state", "=", "sale"]],
        loaded: function(self, order) {
            self.all_orders_list = order;
            self.get_orders_by_id = {};
            order.forEach(function(orders) {
                self.get_orders_by_id[orders.id] = orders;
            });
        },
    });

    models.load_models({
        model: "sale.order.line",
        fields: [
            "order_id",
            "product_id",
            "discount",
            "product_uom_qty",
            "price_unit",
            "price_subtotal",
        ],
        domain: function(self) {
            var order_lines = [];
            var orders = self.all_orders_list;
            for (var i = 0; i < orders.length; i++) {
                order_lines = order_lines.concat(orders[i].order_line);
            }
            return [["id", "in", order_lines]];
        },
        loaded: function(self, sale_order_line) {
            self.all_orders_line_list = sale_order_line;
            self.get_lines_by_id = {};
            sale_order_line.forEach(function(line) {
                self.get_lines_by_id[line.id] = line;
            });

            self.sale_order_line = sale_order_line;
        },
    });

    var SaleOrderButtonWidget = screens.ActionButtonWidget.extend({
        template: "SaleOrderButtonWidget",

        button_click: function() {
            var self = this;
            // This.gui.show_screen('see_all_orders_screen_widget', {});
            self.load_sale_orders().then(function() {
                self.load_sale_order_lines().then(function() {
                    self.gui.show_screen("see_all_orders_screen_widget", {});
                });
            });
        },

        load_sale_orders: function() {
            var self = this;
            var def = new $.Deferred();
            var fields = [
                "name",
                "partner_id",
                "confirmation_date",
                "user_id",
                "amount_untaxed",
                "order_line",
                "session_id",
                "amount_tax",
                "amount_total",
                "company_id",
                "date_order",
                "amount_remaining",
                "amount_remaining_untaxed",
            ];
            var domain = [["state", "=", "sale"]];
            rpc.query(
                {
                    model: "sale.order",
                    method: "search_read",
                    args: [domain, fields],
                },
                {
                    timeout: 3000,
                    shadow: true,
                }
            ).then(
                function(sale_orders) {
                    self.pos.all_orders_list = sale_orders;
                    self.pos.get_orders_by_id = {};
                    sale_orders.forEach(function(orders) {
                        self.pos.get_orders_by_id[orders.id] = orders;
                    });
                    def.resolve();
                },
                function() {
                    def.reject();
                }
            );
            return def;
        },

        load_sale_order_lines: function() {
            var self = this;
            var def = new $.Deferred();
            var fields = [
                "order_id",
                "product_id",
                "discount",
                "product_uom_qty",
                "price_unit",
                "price_subtotal",
            ];
            var domain = function(self) {
                var order_lines = [];
                var orders = self.all_orders_list;
                for (var i = 0; i < orders.length; i++) {
                    order_lines = order_lines.concat(orders[i].order_line);
                }
                return [["id", "in", order_lines]];
            };
            rpc.query(
                {
                    model: "sale.order.line",
                    method: "search_read",
                    args: [domain, fields],
                },
                {
                    timeout: 3000,
                    shadow: true,
                }
            ).then(
                function(sale_order_lines) {
                    self.pos.all_orders_line_list = sale_order_lines;
                    self.pos.get_lines_by_id = {};
                    sale_order_lines.forEach(function(line) {
                        self.pos.get_lines_by_id[line.id] = line;
                    });

                    self.pos.sale_order_lines = sale_order_lines;
                    def.resolve();
                },
                function() {
                    def.reject();
                }
            );
            return def;
        },
    });

    screens.define_action_button({
        name: "See All Orders Button Widget",
        widget: SaleOrderButtonWidget,
        condition: function() {
            return true;
        },
    });

    // SeeAllOrdersScreenWidget start

    var SeeAllOrdersScreenWidget = screens.ScreenWidget.extend({
        template: "SeeAllOrdersScreenWidget",
        init: function(parent, options) {
            this._super(parent, options);
        },

        render_list_orders: function(orders, search_input) {
            // Remove paid orders
            for (var i = 0; i < orders.length; i++) {
                if (orders[i].amount_remaining === 0) orders.splice(i, 1);
            }

            // Perform search
            if (search_input !== undefined && search_input !== "") {
                var selected_search_orders = [];
                var search_text = search_input.toLowerCase();
                for (var i = 0; i < orders.length; i++) {
                    if (orders[i].partner_id === "") {
                        orders[i].partner_id = [0, "-"];
                    }
                    if (
                        orders[i].name.toLowerCase().indexOf(search_text) !== -1 ||
                        orders[i].name.toLowerCase().indexOf(search_text) !== -1 ||
                        orders[i].partner_id[1].toLowerCase().indexOf(search_text) !==
                            -1
                    ) {
                        selected_search_orders = selected_search_orders.concat(
                            orders[i]
                        );
                    }
                }
                orders = selected_search_orders;
            }

            var content = this.$el[0].querySelector(".client-list-contents");
            content.innerHTML = "";
            var orders = orders;
            for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                var ordersline_html = QWeb.render("OrdersLine", {
                    widget: this,
                    order: orders[i],
                });
                var ordersline = document.createElement("tbody");
                ordersline.innerHTML = ordersline_html;
                ordersline = ordersline.childNodes[1];
                content.appendChild(ordersline);
            }
        },

        show: function(options) {
            var self = this;
            this._super(options);
            this.old_sale_order = null;
            this.details_visible = false;
            var orders = self.pos.all_orders_list;
            var orders_lines = self.pos.all_orders_line_list;
            var selectedOrder = 0;
            this.render_list_orders(orders, undefined);

            this.$(".back").click(function() {
                self.gui.show_screen("products");
            });

            // Click "Import" button
            this.$(".client-list-contents").delegate(
                ".sale-order",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    self.gui.show_popup("sale_order_popup_widget", {
                        orderlines: orderlines,
                        order: selectedOrder,
                    });
                }
            );

            // Click "Pay" button
            this.$(".client-list-contents").delegate(
                ".sale-order-pay",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    console.log("Pay: self", self);
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }

                    self.gui.show_popup("sale_order_pay_popup_widget", {
                        order: selectedOrder,
                    });
                }
            );

            // Some other functions)

            this.$(".client-list-contents").delegate(
                ".orders-line-name",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    // Console.log("id========================",order_id)
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    // Console.log("line==========",orderlines);

                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            this.$(".client-list-contents").delegate(
                ".orders-line-date",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    // Console.log("id========================",order_id)
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    // Console.log("line==========",orderlines);

                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            this.$(".client-list-contents").delegate(
                ".orders-line-partner",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    // Console.log("id========================",order_id)
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    // Console.log("line==========",orderlines);

                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            this.$(".client-list-contents").delegate(
                ".orders-line-saleperson",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    // Console.log("id========================",order_id)
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    // Console.log("line==========",orderlines);

                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            this.$(".client-list-contents").delegate(
                ".orders-line-subtotal",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    // Console.log("id========================",order_id)
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            this.$(".client-list-contents").delegate(
                ".orders-line-tax",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });

                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            this.$(".client-list-contents").delegate(
                ".orders-line-tot",
                "click",
                function() {
                    var order_id = parseInt(this.id);
                    // Console.log("id========================",order_id)
                    selectedOrder = null;
                    for (var i = 0, len = Math.min(orders.length, 1000); i < len; i++) {
                        if (orders[i] && orders[i].id === order_id) {
                            selectedOrder = orders[i];
                        }
                    }
                    var orderlines = [];

                    selectedOrder.order_line.forEach(function(line_id) {
                        for (var y = 0; y < orders_lines.length; y++) {
                            if (orders_lines[y].id === line_id) {
                                orderlines.push(orders_lines[y]);
                            }
                        }
                    });
                    self.gui.show_popup("see_order_details_popup_widget", {
                        orderline: orderlines,
                        order: [selectedOrder],
                    });
                }
            );

            // This code is for Search Orders
            this.$(".search-order input").keyup(function() {
                self.render_list_orders(orders, this.value);
            });
        },
    });
    gui.define_screen({
        name: "see_all_orders_screen_widget",
        widget: SeeAllOrdersScreenWidget,
    });

    // Sales Order Popup

    var SaleOrderPopupWidget = popups.extend({
        template: "SaleOrderPopupWidget",
        init: function(parent, args) {
            this._super(parent, args);
            this.options = {};
        },
        //
        show: function(options) {
            options = options || {};
            this._super(options);
            this.orderlines = options.orderlines || [];
        },
        //
        renderElement: function() {
            var self = this;
            this._super();
            var selectedOrder = this.pos.get_order();
            var order = self.options.order;

            var partner_id = false;
            var client = false;
            if (order && order.partner_id !== null) partner_id = order.partner_id[0];
            client = this.pos.db.get_partner_by_id(partner_id);

            var reorder_products = {};

            this.$("#apply_order").click(function() {
                var list_of_qty = $(".entered_item_qty");

                $.each(list_of_qty, function(index, value) {
                    var entered_item_qty = $(value).find("input");
                    var line_id = parseFloat(entered_item_qty.attr("line-id"));
                    var entered_qty = parseFloat(entered_item_qty.val());

                    reorder_products[line_id] = entered_qty;
                });

                for (var i in reorder_products) {
                    var orders_lines = self.pos.all_orders_line_list;
                    for (var n = 0; n < orders_lines.length; n++) {
                        if (orders_lines[n].id === i) {
                            var product = self.pos.db.get_product_by_id(
                                orders_lines[n].product_id[0]
                            );
                            if (product) {
                                selectedOrder.add_product(product, {
                                    quantity: parseFloat(reorder_products[i]),
                                    price: orders_lines[n].price_unit,
                                    discount: orders_lines[n].discount,
                                });
                                selectedOrder.selected_orderline.original_line_id =
                                    orders_lines[n].id;
                                selectedOrder.set_client(client);
                                self.pos.set_order(selectedOrder);
                            } else {
                                alert("please configure product for point of sale.");
                                return;
                            }
                        }
                    }
                }

                self.gui.show_screen("products");
            });
        },
    });

    gui.define_popup({
        name: "sale_order_popup_widget",
        widget: SaleOrderPopupWidget,
    });

    // Sales Order Pay Popup

    var SaleOrderPayWidget = popups.extend({
        template: "SaleOrderPayWidget",
        init: function(parent, args) {
            this._super(parent, args);
            this.options = {};
        },
        //
        show: function(options) {
            options = options || {};
            this._super(options);
        },
        //
        renderElement: function() {
            var self = this;
            this._super();
            var selectedOrder = this.pos.get_order();
            var order = self.options.order;
            console.log("Order and Selected Order", order, selectedOrder);

            var partner_id = false;
            var client = false;
            if (order && order.partner_id !== null) partner_id = order.partner_id[0];
            client = this.pos.db.get_partner_by_id(partner_id);

            // Pay mods
            if (order && order.partner_id !== undefined) {
                $("#amount_paid").val(order.amount_remaining);
            }

            this.$("#apply_payment  ").click(function() {
                var amount_paid = parseFloat($("#amount_paid").val());

                var product = self.pos.db.get_product_by_id(
                    self.pos.config.virtual_product_id[0]
                );
                console.log("Product", product);
                if (product) {
                    selectedOrder.add_product(product, {
                        quantity: parseFloat(1),
                        price: amount_paid,
                        note: _t("Payment for ") + order.name,
                        sale_order_id: order.id,
                    });
                    selectedOrder.set_client(client);
                    self.pos.set_order(selectedOrder);
                    order.amount_remaining -= amount_paid;
                } else {
                    alert("please configure product for point of sale.");
                    return;
                }

                self.gui.show_screen("products");
            });
        },
    });

    gui.define_popup({
        name: "sale_order_pay_popup_widget",
        widget: SaleOrderPayWidget,
    });

    // Pay Sales Details Widget

    var SeeOrderDetailsPopupWidget = popups.extend({
        template: "SeeOrderDetailsPopupWidget",

        init: function(parent, args) {
            this._super(parent, args);
            this.options = {};
        },

        show: function(options) {
            options = options || {};
            this._super(options);

            this.order = options.order || [];
            this.orderline = options.orderline || [];
        },

        events: {
            "click .button.cancel": "click_cancel",
        },

        renderElement: function() {
            this._super();
        },
    });

    gui.define_popup({
        name: "see_order_details_popup_widget",
        widget: SeeOrderDetailsPopupWidget,
    });

    // Notes and related orders

    // Orderline

    var _super_orderline = models.Orderline.prototype;

    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            _super_orderline.initialize.call(this, attr, options);
            this.note = this.note || "";
            this.sale_order_id = this.sale_order_id || "";
        },
        set_note: function(note) {
            this.note = note;
            this.trigger("change", this);
        },
        get_note: function() {
            return this.note;
        },
        can_be_merged_with: function(orderline) {
            if (orderline.get_note() !== this.get_note()) {
                return false;
            }
            return _super_orderline.can_be_merged_with.apply(this, arguments);
        },
        clone: function() {
            var orderline = _super_orderline.clone.call(this);
            orderline.note = this.note;
            orderline.sale_order_id = this.sale_order_id;
            return orderline;
        },
        export_as_JSON: function() {
            var json = _super_orderline.export_as_JSON.call(this);
            json.note = this.note;
            json.sale_order_id = this.sale_order_id;
            return json;
        },
        init_from_JSON: function(json) {
            _super_orderline.init_from_JSON.apply(this, arguments);
            this.note = json.note;
            this.sale_order_id = json.sale_order_id;
        },
        set_sale_order_id: function(sale_order_id) {
            this.sale_order_id = sale_order_id;
            this.trigger("change", this);
        },
        get_sale_order_id: function() {
            return this.sale_order_id;
        },
    });

    // Order

    models.Order = models.Order.extend({
        add_product: function(product, options) {
            if (this._printed) {
                this.destroy();
                return this.pos.get_order().add_product(product, options);
            }
            this.assert_editable();
            options = options || {};
            var attr = JSON.parse(JSON.stringify(product));
            attr.pos = this.pos;
            attr.order = this;
            var line = new models.Orderline(
                {},
                {pos: this.pos, order: this, product: product}
            );

            if (options.quantity !== undefined) {
                line.set_quantity(options.quantity);
            }

            // Add note
            if (options.note !== undefined) {
                line.set_note(options.note);
            }

            // Add Sales Order ID
            if (options.sale_order_id !== undefined) {
                line.set_sale_order_id(options.sale_order_id);
            }

            if (options.price !== undefined) {
                line.set_unit_price(options.price);
            }

            // To substract from the unit price the included taxes mapped by the fiscal position
            this.fix_tax_included_price(line);

            if (options.discount !== undefined) {
                line.set_discount(options.discount);
            }

            if (options.extras !== undefined) {
                for (var prop in options.extras) {
                    line[prop] = options.extras[prop];
                }
            }

            var to_merge_orderline = "";
            for (var i = 0; i < this.orderlines.length; i++) {
                if (
                    this.orderlines.at(i).can_be_merged_with(line) &&
                    options.merge !== false
                ) {
                    to_merge_orderline = this.orderlines.at(i);
                }
            }
            if (to_merge_orderline) {
                to_merge_orderline.merge(line);
            } else {
                this.orderlines.add(line);
            }
            this.select_orderline(this.get_last_orderline());

            if (line.has_product_lot) {
                this.display_lot_popup();
            }
        },
    });
});
