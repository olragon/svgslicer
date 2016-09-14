
var $root = $(document);
var $window = $(window);
var $uploadContainer = $('.upload-container');
var $imageContainer = $('.image-container');
var $resultContainer = $('.result-container');
var $btnDownload = $('#btn-download');
var $btnReset = $('#btn-reset');
var $footer = $('footer').hide();

// dev env
if (process.env.DEV) {
  // live reload
  require('electron-connect').client.create();
  // $footer
  $footer.show();
}

$btnReset.click(function () {
  if (confirm('Are you sure you want to reset? All current data will be lost.')) {
    window.location.reload();
  }
});

$btnDownload.click(function () {
  dialog.showOpenDialog({properties: ['openDirectory']}, function (dirs) {
    var dir = dirs[0];
    var isEmpty = extfs.isEmptySync(dir);
    if (!isEmpty) {
      alert('Folder ' + dir + ' is not empty!');
      return;
    }

    $.blockUI();

    // save image in batch
    async.eachOfLimit($resultContainer.find('img'), 10, function (img, index, callback) {
      var $img = $(img);
      var ratio = $img.data('width') / $img.data('height');

      var canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 800 / ratio;

      canvas.getContext('2d').drawImage(img, 0, 0);
      // canvas.height = this.naturalHeight;
      var img = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
      var fileName = index + '.png';
      if ($img.data('text') && $img.data('text').trim()) {
        fileName = $img.data('text').replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
      }
      fs.writeFile(path.join(dir, fileName), img, 'base64', callback);
    }, function (err) {
      $.unblockUI();
      if (err) { alert('ERROR: ' + err); }
      alert('ALL DONE!');
      $btnDownload.attr('disabled', 'disabled');
    });
  });
});

$uploadContainer
  .on('dragstart', function () {
    $(this).addClass('dragstart');
    return false;
  })
  .on('dragenter', function () {
    $(this).addClass('dragenter');
    return false;
  })
  .on('dragover', function () {
    $(this).addClass('dragover');
    return false;
  })
  .on('dragleave', function () {
    $(this).removeClass(['dragstart', 'dragenter', 'dragleave']);
    return false;
  })
  .on('drop', function (evt) {
    var files = evt.originalEvent.dataTransfer.files;

    // get svg file
    files = _.filter(files, function (file) {
      return file.type.match(/svg/);
    });

    if (files.length > 0) {
      $.blockUI();
      // got files
      $root.trigger('app:files', {files: files});
    } else {
      alert('Cannot detect any SVG file.');
    }

    evt.preventDefault();
    return false;
  });

$root.on('app:files', function (evt, data) {
  var files = data.files;

  // read file content
  async.eachOf(files, function (file, index, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      console.log('read file', e);
      files[index].data = e.target.result;
      callback();
    };
    reader.readAsText(file);
  }, function (err) {
    if (err) { alert('ERROR: ' + err.message) };

    $root.trigger('app:files:loaded', {files: files});
  });
});

$root.on('app:files:loaded', function (evt, data) {
  var files = data.files;

  // display image
  $uploadContainer.animate({ height: 50, width: '30%' });
  _.each(files, function (file, index) {
    $imageContainer.append(file.data);
    files[index].$svg = $imageContainer.find('svg')
      .attr('width', $window.width())
      .removeAttr('height');
  });
  $root.trigger('app:files:displayed', {files: files});
});

$root.on('app:files:displayed', function (evt, data) {
  var files = data.files;

  // fill color
  _.each(files, function (file, index) {
    var groups = d3.select(file.$svg.get(0)).selectAll('g').filter(function (d, i) {
      return this.parentNode.nodeName === 'svg';
    });

    if (groups.size() <= 1) {
      groups = d3.select(file.$svg.get(0)).selectAll('g').filter(function (d, i) {
        return this.parentNode.parentNode.nodeName === 'svg';
      });
    }
    groups.selectAll('*:last-child')
      .attr('opacity', .3)
      .attr('fill', randomColor)
      .attr('class', '');
    files[index].slices = [];
    files[index].images = [];
    groups.each(function () {
      var text = [];
      d3.select(this).selectAll('text').each(function () {
        text.push(d3.select(this).text());
      });
      files[index].slices.push({
        innerHTML: this.innerHTML,
        bbox: this.getBBox(),
        text: text.sort().join(' ')
      });
    });
  });

  $root.trigger('app:files:sliced', { files: files });
});

$root.on('app:files:sliced', function (evt, data) {
  var files = data.files;

  async.eachOf(files, function (file, index, callback) {
    var img = $('<img>');
    async.eachOfSeries(file.slices, function (slice, sIndex, cb) {
      var svg = `<svg xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          xml:space="preserve"
          viewBox="0 0 ${slice.bbox.width} ${slice.bbox.height}" width="800">
        <g transform="translate (-${slice.bbox.x}, -${slice.bbox.y})">${slice.innerHTML}</g>
      </svg>`;
      var mySrc = 'data:image/svg+xml;base64,'+ btoa(svg);
      files[index].images[sIndex] = mySrc;
      cb();
    }, callback);
  }, function (err) {
    console.log(err);
    $root.trigger('app:files:pngGenerated', { files: files });
  });
});

$root.on('app:files:pngGenerated', function (evt, data) {
  var files = data.files;

  // var tpl = `<table>
  // <thead>
  //   <tr>
  //     <th>No.</th>
  //     <th>Image</th>
  //   </tr>
  // </thead>
  // <tbody>
  //   <% _.forEach(images, function (img, index) { %>
  //     <tr>
  //       <td><%- index+1 %></td>
  //       <td><img data-width="<%- slices[index].bbox.width %>" data-height="<%- slices[index].bbox.height %>" style="width: 64px; height: auto;" src="<%- img %>"></td>
  //     </tr>
  //   <% }); %>
  // </tbody>
  // </table>`;
  var tpl = `
    <div class="stats"><h3>Found <%- images.length %> slices.</h3></div>
    <div class="result-list">
    <% _.forEach(images, function (img, index) { %>
      <div class="result-item">
        <span><%- index+1 %></span>
        <span>
          <img
          data-text="<%- slices[index].text %>"
          data-width="<%- slices[index].bbox.width %>"
          data-height="<%- slices[index].bbox.height %>"
          style="width: 64px; height: auto;"
          src="<%- img %>">
        </span>
        <span style="font-size: 8px;"><%- slices[index].text %></span>
      </div>
    <% }); %>
    </div>
  `;
  var tplCompiled = _.template(tpl);
  var output = tplCompiled({ images: files[0].images, slices: files[0].slices });
  $resultContainer.empty().append(output);
  $btnDownload.removeAttr('disabled');
  $.unblockUI();
});
