var SlingshotAutoformFileCache, SwapTemp, events, getCollection, getTemplate, helpers, thumbIconHelpers, uploadWith;

SlingshotAutoformFileCache = new Meteor.Collection(null);

SwapTemp = function(file) {
  var _file, src;
  src = file;
  if (typeof file === 'object' && file.src) {
    if (file.tmp) {
      return file.tmp;
    }
    src = file.src;
  }
  _file = SlingshotAutoformFileCache.findOne({
    src: src,
    tmp: {
      $exists: true
    }
  });
  if (_file) {
    return _file.tmp;
  }
  return src;
};

UI.registerHelper('swapTemp', SwapTemp);

AutoForm.addInputType('slingshotFileUpload', {
  template: 'afSlingshot',
  valueIn: function(images) {
    var t;
    t = Template.instance();
    if (t.data && typeof images === 'string' && images.length > 0) {
      SlingshotAutoformFileCache.upsert({
        template: t.data.id,
        field: t.data.name
      }, {
        template: t.data.id,
        field: t.data.name,
        src: images
      });
    } else {
      _.each(images, function(image, i) {
        var _directives, directives, schema, schemaKey;
        if (typeof image === 'string') {
          schema = AutoForm.getFormSchema();
          if (schema && schema._schema && t.view.isRendered) {
            schemaKey = t.$('[data-schema-key]').data('schema-key');
            if (schemaKey) {
              schemaKey = schemaKey.replace(/\.\d+\./g, '.$.');
              directives = schema._schema[schemaKey].autoform.afFieldInput.slingshotdirective;
              if (directives) {
                _directives = _.map(directives, function(o, k) {
                  if (typeof o === 'string') {
                    o = {
                      directive: o
                    };
                  }
                  o.key = k;
                  return o;
                }).sort(function(a, b) {
                  return -a.key.localeCompare(b.key);
                });
                return SlingshotAutoformFileCache.upsert({
                  template: t.data.id,
                  field: t.data.name,
                  directive: _directives[i].directive
                }, {
                  template: t.data.id,
                  field: t.data.name,
                  directive: _directives[i].directive,
                  key: _directives[i].key,
                  src: image
                });
              }
            }
          }
        } else {
          return SlingshotAutoformFileCache.upsert({
            template: t.data.id,
            field: t.data.name,
            directive: image.directive
          }, _.extend(image, {
            template: t.data.id,
            field: t.data.name
          }));
        }
      });
    }
    return images;
  },
  valueOut: function() {
    var fieldName, images, templateInstanceId;
    fieldName = $(this.context).data('schema-key');
    templateInstanceId = $(this.context).data('id');
    images = SlingshotAutoformFileCache.find({
      template: templateInstanceId,
      field: fieldName
    }, {
      order: {
        key: -1
      }
    }).fetch();
    if (images.length > 0) {
      return images;
    }
    return this.val();
  },
  valueConverters: {
    string: function(images) {
      if (typeof images === 'object' || typeof images === 'array') {
        if (typeof images[0] === 'object') {
          return images[0].src;
        }
      }
      return "";
    },
    stringArray: function(images) {
      var imgs;
      imgs = _.map(images, function(image) {
        return image.src;
      });
      return imgs;
    }
  }
});

AutoForm.addHooks(null, {
  onSuccess: function() {
    if (this.currentDoc && this.currentDoc.pictures) {
      return _.each(this.currentDoc.pictures, function(picture) {
        return SlingshotAutoformFileCache.remove({
          src: picture.src
        });
      });
    }
  }
});

getCollection = function(context) {
  if (typeof context.atts.collection === 'string') {
    context.atts.collection = FS._collections[context.atts.collection] || window[context.atts.collection];
  }
  return context.atts.collection;
};

getTemplate = function(filename, parentView) {
  var template;
  if (filename) {
    filename = filename.toLowerCase();
    template = 'fileThumbIcon' + (parentView.name.indexOf('_ionic') > -1 ? '_ionic' : '');
    if (filename.indexOf('.jpg') > -1 || filename.indexOf('.png') > -1 || filename.indexOf('.gif') > -1) {
      template = 'fileThumbImg' + (parentView.name.indexOf('_ionic') > -1 ? '_ionic' : '');
    }
    return template;
  }
};

uploadWith = function(directive, files, name, key, instance) {
  var directiveName, onBeforeUpload, uploadCallback, uploader;
  if (typeof directive === 'string') {
    directiveName = directive;
  } else if (typeof directive === 'object') {
    if (!directive.directive) {
      console.error('Missing directive in ' + key, directive);
    }
    directiveName = directive.directive;
    if (directive.onBeforeUpload) {
      onBeforeUpload = directive.onBeforeUpload;
    }
  }
  uploader = new Slingshot.Upload(directiveName);
  uploadCallback = function(file) {
    var src, statusTracking, tmp, urlCreator;
    src = '';
    statusTracking = null;
    if (file.type.indexOf('image') === 0) {
      urlCreator = window.URL || window.webkitURL;
      tmp = urlCreator.createObjectURL(file);
    }
    return Meteor.defer((function(_this) {
      return function() {
        var upload;
        upload = uploader.send(file, function(err, src) {
          statusTracking.stop();
          Session.set('uploadStatus', 'done');
          jQuery("button[type='submit'].btn-primary").removeClass('loading');
          jQuery("progress").hide();
          if (err) {
            return console.error(err);
          }
        });
        return statusTracking = Tracker.autorun(function() {
          var status;
          status = upload.status();
          if (status === 'transferring' && upload.instructions) {
            Session.set('uploadStatus', status);
            Session.set('uploadProgress', Math.round(uploader.progress() * 100));

            jQuery("button[type='submit'].btn-primary").addClass('loading');
            return SlingshotAutoformFileCache.upsert({
              template: instance.data.atts.id,
              field: name,
              directive: directiveName
            }, {
              template: instance.data.atts.id,
              field: name,
              key: key || '',
              directive: directiveName,
              filename: file.name,
              src: upload.instructions.download,
              tmp: tmp
            });
          }
        });
      };
    })(this));
  };
  return _.map(files, function(file) {
    if (onBeforeUpload) {
      return onBeforeUpload(file, uploadCallback);
    } else {
      return uploadCallback(file);
    }
  });
};

events = {
  "change .file-upload": function(e, instance) {
    var directives, files, name;
    files = e.target.files;
    if (typeof files === "undefined" || (files.length === 0)) {
      return;
    }
    directives = instance.data.atts.slingshotdirective;
    name = $(e.target).attr('file-input');
    if (typeof directives === 'string') {
      return uploadWith(directives, files, name, null, instance);
    } else if (typeof directives === 'object' && 'directive' in directives) {
      return uploadWith(directives, files, name, null, instance);
    } else if (typeof directives === 'object') {
      return _.each(directives, function(directive, key) {
        return uploadWith(directive, files, name, key, instance);
      });
    }
  },
  'click .file-upload-clear': function(e, instance) {
    var name;
    name = $(e.currentTarget).attr('file-input');
    return SlingshotAutoformFileCache.remove({
      template: instance.data.atts.id,
      field: name
    });
  }
};

Template['afSlingshot'].events(events);

Template['afSlingshot_bootstrap3'].events(events);

Template['afSlingshot_ionic'].events(_.extend(events, {
  'click [data-action=showActionSheet]': function(event) {
    return IonActionSheet.show({
      buttons: [],
      destructiveText: i18n('destructive_text'),
      cancelText: i18n('cancel_text'),
      destructiveButtonClicked: (function() {
        SlingshotAutoformFileCache.remove({
          template: this.template,
          field: this.field
        });
        return true;
      }).bind(this)
    });
  }
}));

helpers = {
  label: function() {
    if (this.atts && this.atts.label) {
      return this.atts.label;
    } else {
      return 'Choose file';
    }
  },
  removeLabel: function() {
    return this.atts['removeLabel'] || 'Remove';
  },
  skipGroupLabel: function() {
    var data;
    data = Template.parentData(6);
    if (data && data.data) {
      return data.data.skipLabel;
    }
    return false;
  },
  accept: function() {
    return this.atts.accept || '*';
  },
  schemaKey: function() {
    return this.atts['data-schema-key'];
  },
  templateInstanceId: function() {
    return this.atts['id'];
  },
  fileUpload: function() {
    var file, select, t;
    t = Template.instance();
    select = {
      template: t.data.atts.id,
      field: this.atts.name
    };
    if (this.atts.thumbnail) {
      select.$or = [
        {
          directive: this.atts.thumbnail
        }, {
          key: this.atts.thumbnail
        }
      ];
    }
    file = SlingshotAutoformFileCache.findOne(select);
    if (file) {
      return {
        data: file,
        template: getTemplate(file.filename || file.src, t.view)
      };
    }
  }
};

Template['afSlingshot'].helpers(helpers);

Template['afSlingshot_ionic'].helpers(helpers);

Template['afSlingshot_bootstrap3'].helpers(helpers);

thumbIconHelpers = {
  filename: function() {
    var filename;
    if (this.filename) {
      filename = this.filename;
      if (filename.length > 23) {
        filename = filename.slice(0, 22) + '...';
      }
      return filename;
    } else if (this.src) {
      filename = this.src.replace(/^.*[\\\/]/, '');
      if (filename.length > 23) {
        filename = filename.slice(0, 22) + '...';
      }
      return filename;
    }
  }
};

Template['fileThumbIcon'].helpers(thumbIconHelpers);

Template['fileThumbIcon_bootstrap3'].helpers(_.extend(thumbIconHelpers, {
  icon: function() {
    var file, icon;
    if (this.filename) {
      file = this.filename.toLowerCase();
      icon = 'document';
      if (file.indexOf('youtube.com') > -1) {
        icon = 'youtube';
      } else if (file.indexOf('vimeo.com') > -1) {
        icon = 'vimeo-square';
      } else if (file.indexOf('.pdf') > -1) {
        icon = 'file-pdf-o';
      } else if (file.indexOf('.doc') > -1 || file.indexOf('.docx') > -1) {
        icon = 'file-word-o';
      } else if (file.indexOf('.ppt') > -1) {
        icon = 'file-powerpoint-o';
      } else if (file.indexOf('.avi') > -1 || file.indexOf('.mov') > -1 || file.indexOf('.mp4') > -1) {
        icon = 'file-movie-o';
      } else if (file.indexOf('.png') > -1 || file.indexOf('.jpg') > -1 || file.indexOf('.gif') > -1 || file.indexOf('.bmp') > -1) {
        icon = 'file-image-o';
      } else if (file.indexOf('http://') > -1 || file.indexOf('https://') > -1) {
        icon = 'link';
      }
      return icon;
    }
  }
}));

Template.fileThumbIcon_ionic.helpers(_.extend(thumbIconHelpers, {
  icon: function() {
    var file, icon;
    file = "";
    if (this.filename) {
      file = this.filename.toLowerCase();
    } else {
      file = this.src.toLowerCase();
    }
    icon = 'file-o';
    if (file.indexOf('youtube.com') > -1) {
      icon = 'social-youtube';
    } else if (file.indexOf('vimeo.com') > -1) {
      icon = 'social-vimeo';
    } else if (file.indexOf('.pdf') > -1) {
      icon = 'document-text';
    } else if (file.indexOf('.doc') > -1 || file.indexOf('.docx') > -1) {
      icon = 'document-text';
    } else if (file.indexOf('.ppt') > -1) {
      icon = 'document';
    } else if (file.indexOf('.avi') > -1 || file.indexOf('.mov') > -1 || file.indexOf('.mp4') > -1) {
      icon = 'ios-videocam-outline';
    } else if (file.indexOf('.png') > -1 || file.indexOf('.jpg') > -1 || file.indexOf('.gif') > -1 || file.indexOf('.bmp') > -1) {
      icon = 'image';
    } else if (file.indexOf('http://') > -1 || file.indexOf('https://') > -1) {
      icon = 'link';
    }
    return icon;
  }
}));


Template.progressBar.helpers({
  progress: function () {
    return Session.get("uploadProgress");
  }

});

// ---
// generated by coffee-script 1.9.2
