from odoo import _, api, fields, models

from odoo.addons import decimal_precision as dp


##############
# POS Config #
##############
class CxPOSConfig(models.Model):
    _inherit = "pos.config"

    check = fields.Boolean(string="Import Sales Orders", default=False)
    virtual_product_id = fields.Many2one(
        string="Virtual POS Product",
        comodel_name="product.product",
        domain=[("type", "=", "service")],
    )


##################
# POS Order Line #
##################
class CxPOSOrderLine(models.Model):
    _inherit = "pos.order.line"

    sale_order_id = fields.Many2one(string="Sales Order", comodel_name="sale.order")


###############
# Sales Order #
###############
class CxSalesOrder(models.Model):
    _inherit = "sale.order"

    pos_order_line_ids = fields.One2many(
        string="POS Order Lines",
        comodel_name="pos.order.line",
        inverse_name="sale_order_id",
    )
    pos_order_ids = fields.One2many(
        string="POS Orders", comodel_name="pos.order", compute="_compute_pos_orders"
    )
    pos_order_count = fields.Integer(string="POS Orders", compute="_compute_pos_orders")

    amount_paid = fields.Monetary(
        string="Paid",
        store=False,
        readonly=True,
        compute="_compute_amount_all",
        digits=dp.get_precision("Product Price"),
    )
    amount_paid_pos = fields.Monetary(
        string="Paid in POS",
        store=True,
        readonly=True,
        compute="_compute_amount_pos",
        digits=dp.get_precision("Product Price"),
    )
    amount_remaining = fields.Monetary(
        string="Remaining",
        store=False,
        readonly=True,
        compute="_compute_amount_all",
        digits=dp.get_precision("Product Price"),
    )
    amount_remaining_untaxed = fields.Monetary(
        string="Remaining Untaxed",
        digits=dp.get_precision("Product Price"),
        store=False,
        readonly=True,
        compute="_compute_amount_all",
    )
    invoice_status = fields.Selection(selection_add=[("pos_paid", "Paid in POS")])

    # -- Get POS orders
    @api.depends("pos_order_line_ids")
    @api.multi
    def _compute_pos_orders(self):
        for rec in self:
            pos_order_ids = [
                order.id for order in rec.pos_order_line_ids.mapped("order_id")
            ]
            rec.update(
                {"pos_order_ids": pos_order_ids, "pos_order_count": len(pos_order_ids)}
            )

    # -- Compute amount paid in POS
    @api.depends("pos_order_line_ids")
    @api.multi
    def _compute_amount_pos(self):
        for rec in self:
            rec.amount_paid_pos = sum(
                x.price_subtotal_incl for x in rec.pos_order_line_ids
            )

    @api.depends("order_line.price_total", "invoice_ids.state", "amount_paid_pos")
    def _compute_amount_all(self):
        """
        Compute the total amounts of the SO.
        """
        for order in self:
            amount_untaxed = amount_tax = 0.0
            for line in order.order_line:
                amount_untaxed += line.price_subtotal
                amount_tax += line.price_tax

            total_amount = amount_untaxed + amount_tax
            amount_paid = sum(
                (inv.amount_total - inv.residual)
                for inv in order.invoice_ids.filtered(lambda i: i.state == "open")
            )
            amount_remaining = total_amount - amount_paid - order.amount_paid_pos
            amount_remaining_untaxed = (
                amount_remaining / total_amount * amount_untaxed
                if total_amount
                else amount_untaxed
            )

            order.update(
                {
                    "amount_untaxed": order.pricelist_id.currency_id.round(
                        amount_untaxed
                    ),
                    "amount_tax": order.pricelist_id.currency_id.round(amount_tax),
                    "amount_total": total_amount,
                    "amount_paid": amount_paid,
                    "amount_remaining": amount_remaining,
                    "amount_remaining_untaxed": order.pricelist_id.currency_id.round(
                        amount_remaining_untaxed
                    ),
                }
            )

    # -- Open related POS Orders
    @api.multi
    def act_so_2_pos(self):
        self.ensure_one()

        return {
            "name": _("POS Orders"),
            "views": [[False, "tree"], [False, "form"]],
            "res_model": "pos.order",
            "type": "ir.actions.act_window",
            "target": "current",
            "domain": [("id", "in", self.pos_order_ids.ids)],
        }

    # -- Compute Invoice status
    @api.depends("state", "order_line.invoice_status", "pos_order_ids.state")
    def _get_invoiced(self):
        not_pos = self.env["sale.order"]
        # -- Paid in POS?
        for order in self:
            if len(order.pos_order_ids) > 0 and order.amount_remaining == 0:
                order.invoice_status = "pos_paid"
            else:
                not_pos += order
        if len(not_pos) > 0:
            return super(CxSalesOrder, not_pos)._get_invoiced()
