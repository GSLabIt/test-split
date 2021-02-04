==================================
Base Location Italin Cities Import
==================================


.. |badge1| image:: https://img.shields.io/badge/licence-LGPL--3-blue.png
    :target: http://www.gnu.org/licenses/agpl-3.0-standalone.html
    :alt: License: AGPL-3
.. |badge2| image:: https://img.shields.io/badge/runbot-Try%20me-875A7B.png
    :target: https://ooops404.com/runbot/1/12.0
    :alt: Try me on Runbot

|badge1| |badge2| 

This module adds a wizard to import cities and/or city zip entries from
`Database Comuni Italiani <https://github.com/matteocontrini/comuni-json>`

**Table of contents**

.. contents::
   :local:

Installation
============

To install this module, you need the Python library 'requests'::

    pip install requests


Configuration
=============

To access the menu to import city zip entries from Database
you must add yourself to the groups *Administration / Settings* or, if you have sale module
installed, *Sales / Manager* group.

If you want/need to modify the default URL
(https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json), you can set the *istat_codes.url*
system parameter.

Usage
=====

Go to *Contacts > Configuration > Localization > Import Italian Cities*,
and click on it to open a wizard.

When you start the wizard, it will ask you to select a Italy country.

Then, it will delete all not detected entries, download
the latest version of the list of cities and create new city zip entries.

Bug Tracker
===========

Bugs are tracked on `GitHub Issues <https://github.com/OCA/ooops-release/issues>`_.
In case of trouble, please check there if your issue has already been reported.


Credits
=======

Authors
~~~~~~~

* Ooops

Contributors
~~~~~~~~~~~~

* Giovanni - GSLab.it


Maintainers
~~~~~~~~~~~

This module is maintained by the Ooops.

.. image:: https://www.ooops403.com/logo.png
   :alt: Ooops403
   :target: https://www.ooops403.com
