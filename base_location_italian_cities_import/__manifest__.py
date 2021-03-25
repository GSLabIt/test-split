{
    "name": "Base Location Italian Cities Import",
    "version": "12.0.1.0.0",
    "category": "Partner Management",
    "license": "LGPL-3",
    "summary": "Import Italian Cities along with istat and zip entries",
    "author": "Ooops",
    "website": "https://github.com/shopinvader/odoo-pim",
    "depends": ["base_location"],
    "data": ["views/res_city_view.xml", "wizard/istat_import_view.xml"],
    "external_dependencies": {"python": ["requests"]},
    "installable": True,
}
