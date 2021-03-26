from odoo import fields, models


class City(models.Model):
    _inherit = "res.city"

    istat_code = fields.Char(string="ISTAT Code")
