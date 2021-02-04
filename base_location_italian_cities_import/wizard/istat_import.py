import logging

import requests

from odoo import _, api, fields, models
from odoo.exceptions import UserError

logger = logging.getLogger(__name__)

URL_ISTAT_CODES = \
    'https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json'


class CityZipIstatImport(models.TransientModel):
    _name = 'city.zip.istat.import'
    _description = 'Import Italy City Zips, Istat codes'
    _rec_name = 'country_id'

    def _get_default_country(self):
        return self.country_id.search([('code', '=', 'IT')])

    country_id = fields.Many2one(
        'res.country', 'Country', required=True, default=_get_default_country
    )
    letter_case = fields.Selection(
        [
            ('unchanged', 'Unchanged'),
            ('title', 'Title Case'),
            ('upper', 'Upper Case'),
        ],
        string='Letter Case',
        default='unchanged',
        help="Converts retreived city and state names to Title Case "
        "(upper case on each first letter of a word) or Upper Case "
        "(all letters upper case)."
    )

    @api.model
    def transform_city_name(self, city, country):
        """Override it for transforming city name (if needed)
        :param city: Original city name
        :param country: Country record
        :return: Transformed city name
        """
        res = city
        if self.letter_case == 'title':
            res = city.title()
        elif self.letter_case == 'upper':
            res = city.upper()
        return res

    @api.model
    def _domain_search_city_zip(self, cap, city_id=False):
        domain = [('name', '=', cap)]
        if city_id:
            domain += [('city_id', '=', city_id)]
        return domain

    @api.model
    def select_state(self, row, country):
        return self.env['res.country.state'].search(
            [('country_id', '=', country.id), ('code', '=', row['sigla'])],
            limit=1,
        )

    @api.model
    def select_city(self, row, country, state_id):
        # This has to be done by SQL for performance reasons avoiding
        # left join with ir_translation on the translatable field "name"
        self.env.cr.execute(
            "SELECT id, name FROM res_city "
            "WHERE name = %s AND country_id = %s AND state_id = %s LIMIT 1",
            (self.transform_city_name(row['nome'], country), country.id, state_id)
        )
        row_city = self.env.cr.fetchone()
        return (row_city[0], row_city[1]) if row_city else (False, False)

    @api.model
    def select_zip(self, row, cap, country, state_id):
        city_id, _ = self.select_city(row, country, state_id)
        return self.env['res.city.zip'].search(
            self._domain_search_city_zip(cap, city_id)
        )

    @api.model
    def prepare_state(self, row, country):
        return {
            'name': row['provincia']['nome'],
            'code': row['sigla'],
            'country_id': country.id,
        }

    @api.model
    def prepare_city(self, row, country, state_id):
        vals = {
            'name': self.transform_city_name(row['nome'], country),
            'state_id': state_id,
            'country_id': country.id,
            'istat_code': row['codice']
        }
        return vals

    @api.model
    def prepare_zip(self, cap, city_id):
        return {'name': cap, 'city_id': city_id}

    @api.model
    def get_and_parse_csv(self):
        url = self.env['ir.config_parameter'].get_param(
            'istat_codes.url', default=URL_ISTAT_CODES
        )
        logger.info('Starting to download %s' % url)
        res_request = requests.get(url)
        if res_request.status_code != requests.codes.ok:
            raise UserError(
                _('Got an error %d when trying to download the file %s.') %
                (res_request.status_code, url)
            )
        return res_request.json()

    def _create_states(self, parsed_json, search_states, max_import):
        # States
        state_vals_list = []
        state_dict = {}
        for i, row in enumerate(parsed_json):
            if max_import and i == max_import:
                break
            state = self.select_state(row, self.country_id) if search_states else False
            if not state:
                state_vals = self.prepare_state(row, self.country_id)
                if state_vals not in state_vals_list:
                    state_vals_list.append(state_vals)
            else:
                state_dict[state.code] = state.id

        created_states = self.env['res.country.state'].create(state_vals_list)
        for i, vals in enumerate(state_vals_list):
            state_dict[vals['code']] = created_states[i].id
        return state_dict

    def _create_cities(self, parsed_json, search_cities, max_import, state_dict):
        # Cities
        city_vals_list = []
        city_dict = {}
        for i, row in enumerate(parsed_json):
            if max_import and i == max_import:
                break
            state_id = state_dict[row['sigla']]
            city_id, city_name = (
                self.select_city(row, self.country_id, state_id) if search_cities else
                (False, False)
            )
            if not city_id:
                city_vals = self.prepare_city(row, self.country_id, state_id)
                if city_vals not in city_vals_list:
                    city_vals_list.append(city_vals)
            else:
                city = self.env['res.city'].browse(city_id)
                if city.istat_code != row['codice']:
                    city.write({'istat_code': row['codice']})
                city_dict[(city_name, state_id)] = city_id
        ctx = dict(self.env.context)
        ctx.pop('lang', None)  # make sure no translation is added
        created_cities = self.env['res.city'].with_context(ctx).create(city_vals_list)
        for i, vals in enumerate(city_vals_list):
            city_dict[(vals['name'], vals['state_id'])] = created_cities[i].id
        return city_dict

    @api.multi
    def run_import(self):
        self.ensure_one()
        parsed_json = self.get_and_parse_csv()
        return self._process_csv(parsed_json)

    def _process_csv(self, parsed_json):
        state_model = self.env['res.country.state']
        zip_model = self.env['res.city.zip']
        res_city_model = self.env['res.city']
        # Store current record list
        old_zips = set(
            zip_model.search([('city_id.country_id', '=', self.country_id.id)]).ids
        )
        search_zips = len(old_zips) > 0
        old_cities = set(
            res_city_model.search([('country_id', '=', self.country_id.id)]).ids
        )
        search_cities = len(old_cities) > 0
        current_states = state_model.search([('country_id', '=', self.country_id.id)])
        search_states = len(current_states) > 0
        max_import = self.env.context.get('max_import', 0)
        logger.info('Starting to create the cities and/or city zip entries')
        # Pre-create states and cities
        state_dict = self._create_states(parsed_json, search_states, max_import)
        city_dict = self._create_cities(
            parsed_json, search_cities, max_import, state_dict
        )
        # Zips
        zip_vals_list = []
        for i, row in enumerate(parsed_json):
            if max_import and i == max_import:
                break
            for cap in row['cap']:
                # Don't search if there aren't any records
                zip_code = False
                state_id = state_dict[row['sigla']]
                if search_zips:
                    zip_code = self.select_zip(row, cap, self.country_id, state_id)
                if not zip_code:
                    city_id = city_dict[(
                        self.transform_city_name(row['nome'], self.country_id),
                        state_id,
                    )]
                    zip_vals = self.prepare_zip(cap, city_id)
                    if zip_vals not in zip_vals_list:
                        zip_vals_list.append(zip_vals)
                else:
                    old_zips.remove(zip_code.id)

        self.env['res.city.zip'].create(zip_vals_list)
        if not max_import:
            if old_zips:
                logger.info('removing city zip entries')
                self.env['res.city.zip'].browse(list(old_zips)).unlink()
                logger.info(
                    '%d city zip entries deleted for country %s' %
                    (len(old_zips), self.country_id.name)
                )
            old_cities -= set(city_dict.values())
            if old_cities:
                logger.info('removing city entries')
                self.env['res.city'].browse(list(old_cities)).unlink()
                logger.info(
                    '%d res.city entries deleted for country %s' %
                    (len(old_cities), self.country_id.name)
                )
        logger.info(
            'The wizard to create cities and/or city zip entries from '
            'istat codes has been successfully completed.'
        )
        return True
