Package.describe({
  name: "rizafahmi:autoform-slingshot",
  summary: "File upload for AutoForm with Slingshot plus progressbar",
  description: "File upload for AutoForm with Slingshot adding progressbar for better UX",
  version: "1.1.3",
  git: "http://github.com/rizafahmi/autoform-slingshot.git"
});

Package.onUse(function(api) {
  configure(api);
});

function configure(api) {
  api.versionsFrom('METEOR@1.2');

  api.use([
    'underscore',
    'templating',
    'less',
    'jquery',
    'aldeed:autoform@5.3.0',
    'edgee:slingshot@0.6.2',
    "tap:i18n@1.5.1"
  ], ['client', 'server']);

  api.imply([
    'aldeed:autoform',
    'edgee:slingshot',
    'tap:i18n'
  ]);

  api.addFiles('i18n/package-tap.i18n', ["client", "server"]);

  api.addFiles([
    'lib/client/autoform-slingshot.html',
    'lib/client/autoform-slingshot.less',
    'lib/client/autoform-slingshot.js'
  ], 'client');

  api.add_files([
    "i18n/en.i18n.json",
    "i18n/sv.i18n.json"
  ], ["client", "server"]);

  api.export('SwapTemp');
}
