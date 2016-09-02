SlingshotAutoformFileCache = new Meteor.Collection(null);

SwapTemp = (file) ->
  src = file
  if typeof file == 'object' and file.src
    if file.tmp
      return file.tmp
    src = file.src
  _file = SlingshotAutoformFileCache.findOne
    src: src
    tmp:
      $exists: true
  if _file
    return _file.tmp
  return src

UI.registerHelper 'swapTemp', SwapTemp

AutoForm.addInputType 'slingshotFileUpload',
  template: 'afSlingshot'
  valueIn: (images) ->
    # Add input data into the file cache.
    t = Template.instance()
    if t.data and typeof images == 'string' and images.length > 0
      SlingshotAutoformFileCache.upsert {
        template: t.data.id
        field: t.data.name
      }, {
        template: t.data.id
        field: t.data.name
        src: images
      }
    else
      _.each images, (image, i) ->
        if typeof image == 'string'
          schema = AutoForm.getFormSchema()
          if schema and schema._schema and t.view.isRendered
            schemaKey = t.$('[data-schema-key]').data('schema-key')
            if schemaKey
              # Replace ".0." with ".$."
              schemaKey = schemaKey.replace(/\.\d+\./g, '.$.')
              directives = schema._schema[schemaKey].autoform.afFieldInput.slingshotdirective
              if directives
                _directives = _.map(directives, (o, k) ->
                  if typeof o == 'string'
                    o = {directive: o}
                  o.key = k
                  return o
                  ).sort((a, b) ->
                    -a.key.localeCompare b.key
                  )
                SlingshotAutoformFileCache.upsert {
                  template: t.data.id
                  field: t.data.name
                  directive: _directives[i].directive
                }, {
                  template: t.data.id
                  field: t.data.name
                  directive: _directives[i].directive
                  key: _directives[i].key
                  src: image
                }
        else
          SlingshotAutoformFileCache.upsert {
            template: t.data.id
            field: t.data.name
            directive: image.directive
          }, _.extend(image,
            template: t.data.id
            field: t.data.name
          )
    images

  valueOut: ->
    fieldName = this.data('schema-key')
    templateInstanceId = this.data('id')
    images = SlingshotAutoformFileCache.find({
      template: templateInstanceId
      field: fieldName
    }, {
      order:
        key: -1
    }).fetch()
    if images.length > 0
      return images
    return @val()

  valueConverters:
    string: (images)->
      if typeof images == 'object' or typeof images == 'array'
        if typeof images[0] == 'object'
          return images[0].src
      return ""

    stringArray: (images)->
      imgs = _.map( images, (image)-> image.src )
      imgs

# Remove pictures from cache when saved to document.
AutoForm.addHooks null,
  onSuccess: ->
    if @currentDoc and @currentDoc.pictures
      _.each @currentDoc.pictures, (picture) ->
        SlingshotAutoformFileCache.remove({src: picture.src});

getCollection = (context) ->
  if typeof context.atts.collection == 'string'
    context.atts.collection = FS._collections[context.atts.collection] or window[context.atts.collection]
  return context.atts.collection

getTemplate = (filename, parentView) ->
  if filename
    filename = filename.toLowerCase()
    template = 'fileThumbIcon' + (if parentView.name.indexOf('_ionic') > -1 then '_ionic' else '')
    if filename.indexOf('.jpg') > -1 || filename.indexOf('.png') > -1 || filename.indexOf('.gif') > -1
      template = 'fileThumbImg' + (if parentView.name.indexOf('_ionic') > -1 then '_ionic' else '')
    template

uploadWith = (directive, files, name, key, instance) ->
  if typeof directive == 'string'
    directiveName = directive
  else if typeof directive == 'object'
    if !directive.directive
      console.error 'Missing directive in ' + key, directive
    directiveName = directive.directive
    if directive.onBeforeUpload
      onBeforeUpload = directive.onBeforeUpload

  uploader = new Slingshot.Upload(directiveName)

  uploadCallback = (file) ->
    src = ''
    statusTracking = null

    if file.type.indexOf('image') == 0
      urlCreator = window.URL or window.webkitURL;
      tmp = urlCreator.createObjectURL( file );
    Meteor.defer =>
      upload = uploader.send file, (err, src) ->
        # Stop tracking status when upload is done.
        statusTracking.stop()
        if err
          console.error err

      # Wait for authorization and for transfer to start.
      statusTracking = Tracker.autorun =>
        status = upload.status()
        if status == 'transferring' and upload.instructions
          # Add a placeholder for the upload with a Blob data URI, aka Optimistic UI.
          SlingshotAutoformFileCache.upsert {
            template: instance.data.atts.id
            field: name
            directive: directiveName
          }, {
            template: instance.data.atts.id
            field: name
            key: key or ''
            directive: directiveName
            filename: file.name
            src: upload.instructions.download
            tmp: tmp
          }

  # Send uploadCallback direcly or pass it through onBeforeUpload if available.
  _.map files, (file) ->
    if onBeforeUpload
      onBeforeUpload file, uploadCallback #.bind(instance)
    else
      uploadCallback file

events =
  "change .file-upload": (e, instance) ->
    files = e.target.files
    if typeof files is "undefined" || (files.length is 0) then return

    # Support single and multiple directives.
    directives = instance.data.atts.slingshotdirective;
    name = $(e.target).attr('file-input')

    # If single directive upload.
    if typeof directives == 'string'
      uploadWith directives, files, name, null, instance

    # If singe directive as object.
    else if typeof directives == 'object' and 'directive' of directives
      uploadWith directives, files, name, null, instance

    # If multiple directive upload with keys.
    else if typeof directives == 'object'
      _.each directives, (directive, key) ->
        uploadWith directive, files, name, key, instance

  'click .file-upload-clear': (e, instance)->
    name = $(e.currentTarget).attr('file-input')
    SlingshotAutoformFileCache.remove
      template: instance.data.atts.id
      field: name

Template['afSlingshot'].events events
Template['afSlingshot_bootstrap3'].events events
Template['afSlingshot_ionic'].events _.extend(events, {
  'click [data-action=showActionSheet]': (event) ->
    IonActionSheet.show(
      buttons: []
      destructiveText: i18n 'destructive_text'
      cancelText: i18n 'cancel_text'
      destructiveButtonClicked: (()->
        SlingshotAutoformFileCache.remove({template: this.template, field: this.field});
        true
      ).bind(this)
    )
})


helpers =
  label: ->
    if @atts and @atts.label
      @atts.label
    else
      'Choose file'
  removeLabel: ->
    @atts['removeLabel'] or 'Remove'

  skipGroupLabel: ->
    data = Template.parentData(6)
    if data and data.data
      return data.data.skipLabel
    false
  accept: ->
    @atts.accept or '*'
  schemaKey: ->
    @atts['data-schema-key']
  templateInstanceId: ->
    @atts['id']

  fileUpload: ->
    t = Template.instance()
    select =
      template: t.data.atts.id
      field: @atts.name
    # Allow selection of the directive for the thumbnail by key.
    if @atts.thumbnail
      select.$or = [{directive: @atts.thumbnail}, {key: @atts.thumbnail}]
    file = SlingshotAutoformFileCache.findOne(select)
    if file
      data: file
      template: getTemplate file.filename or file.src, t.view

Template['afSlingshot'].helpers helpers
Template['afSlingshot_ionic'].helpers helpers
Template['afSlingshot_bootstrap3'].helpers helpers

thumbIconHelpers =
  filename: ->
    if @filename
      filename = @filename
      if filename.length > 23
        filename = filename.slice(0, 22) + '...'
      filename
    else if @src
      filename = @src.replace(/^.*[\\\/]/, '');
      if filename.length > 23
        filename = filename.slice(0, 22) + '...'
      filename

Template['fileThumbIcon'].helpers thumbIconHelpers

Template['fileThumbIcon_bootstrap3'].helpers _.extend(thumbIconHelpers, {
  icon: ->
    if @filename
      file = @filename.toLowerCase()
      icon = 'document'
      if file.indexOf('youtube.com') > -1
        icon = 'youtube'
      else if file.indexOf('vimeo.com') > -1
        icon = 'vimeo-square'
      else if file.indexOf('.pdf') > -1
        icon = 'file-pdf-o'
      else if file.indexOf('.doc') > -1 || file.indexOf('.docx') > -1
        icon = 'file-word-o'
      else if file.indexOf('.ppt') > -1
        icon = 'file-powerpoint-o'
      else if file.indexOf('.avi') > -1 || file.indexOf('.mov') > -1 || file.indexOf('.mp4') > -1
        icon = 'file-movie-o'
      else if file.indexOf('.png') > -1 || file.indexOf('.jpg') > -1 || file.indexOf('.gif') > -1 || file.indexOf('.bmp') > -1
        icon = 'file-image-o'
      else if file.indexOf('http://') > -1 || file.indexOf('https://') > -1
        icon = 'link'
      icon
})

Template.fileThumbIcon_ionic.helpers _.extend(thumbIconHelpers, {
  icon: ->
    file = ""
    if @filename
      file = @filename.toLowerCase()
    else
      file = @src.toLowerCase()
    icon = 'file-o'
    if file.indexOf('youtube.com') > -1
      icon = 'social-youtube'
    else if file.indexOf('vimeo.com') > -1
      icon = 'social-vimeo'
    else if file.indexOf('.pdf') > -1
      icon = 'document-text'
    else if file.indexOf('.doc') > -1 || file.indexOf('.docx') > -1
      icon = 'document-text'
    else if file.indexOf('.ppt') > -1
      icon = 'document'
    else if file.indexOf('.avi') > -1 || file.indexOf('.mov') > -1 || file.indexOf('.mp4') > -1
      icon = 'ios-videocam-outline'
    else if file.indexOf('.png') > -1 || file.indexOf('.jpg') > -1 || file.indexOf('.gif') > -1 || file.indexOf('.bmp') > -1
      icon = 'image'
    else if file.indexOf('http://') > -1 || file.indexOf('https://') > -1
      icon = 'link'
    icon
})
