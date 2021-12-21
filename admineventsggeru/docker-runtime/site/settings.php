<?php

/**
 * @file
 * Custom single site-specific settings. @see prj-settings.inc for default settings.
*/ // It's not in the common settings file because for multi-site we need // to specify different settings, i.e. DB connection.
$site_settings_filename = 'admin.events.gge.ru-settings.inc';
require(DRUPAL_ROOT . '/sites/prj-settings.inc'); // Store all values in single array to make possible to switch to dev values even on prod site.
$conf['push_me']['apns']['certificates'] = array(
 'default' => array(
   'dev' => 'AdminDevKey.pem',
   'prod' => 'AdminProdKey.pem',
 ),
);

