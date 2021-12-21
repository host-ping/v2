<?php

/**
 * @file
 * Env-dependent settings file.
*/

$databases['default']['default'] = array(
  'driver' => 'mysql',
  'database' => 'admineventsggeru',
  'username' => 'admineventsggeru',
  'password' => 'pl9QbQJW1h0warROzJ6COw',
  'host' => '10.166.29.5',
  'prefix' => '',
  'charset' => 'utf8mb4',
  'collation' => 'utf8mb4_general_ci', );

$conf['file_public_path'] = 'sites/admin.events.gge.ru/files';
$conf['file_private_path'] = 'sites/admin.events.gge.ru/files/private';
$conf['file_temporary_path'] = '/tmp';

if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] == 'https') {
   $_SERVER['HTTPS'] = 'on';
}


