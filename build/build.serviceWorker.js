"use strict"

const path = require('path')
const fs = require('fs-extra')
const md5 = require('md5')
const recursive = require('recursive-readdir');
const config = require(path.resolve(__dirname, '../src/app.config.js'));
const distFolder = 'dist/';
const dirPath = path.resolve(__dirname,'../' + distFolder);

var self = this;
self.assetFiles = [];
self.assetCacheHash = "";

const generateAssetHash = () => {
  return new Promise((resolve, reject) => {
    getAllAssets().then((assetFiles) => {
      self.assetFiles = assetFiles;
      self.assetCacheHash = md5(self.assetFiles.join(''));
      resolve();
    })
  });
}

const getAllAssets = () => {
  return new Promise((resolve, reject) => {
    var assetFiles = [];
    recursive(dirPath, (err, files) => {
      files.forEach(file => {
        assetFiles.push(getUrlPath(file));
      })
      resolve(assetFiles);
    });
  });
}

const getHashedFile = (fileNameRegex) => {
  return new Promise((resolve, reject) => {
    var localCacheFile = "";
    fs.readdir(distFolder, (err, files) => {
      files.forEach(file => {
        var match = file.match(fileNameRegex);
        if(match){
          resolve(file);
        }
      });
      if(localCacheFile === ""){reject();}
    })
  });
}

const getUrlPath = (str) => {
  return str.replace(dirPath,'').replace(/\\/gi,'/').replace(distFolder,'')
}

const generateSwConfigFile = () => {
  return new Promise((resolve, reject) => {
    var swConfigFilename = 'sw_config_' + self.assetCacheHash + '.js';
    fs.outputFile( (dirPath + "/" + swConfigFilename), 'var config = ' +  JSON.stringify({
      assets: self.assetFiles,
      paths:{api:config.wpDomain + 'wp-json', remote:config.wpDomain},
      cacheNames:{assetCache:`vwpCacheAsset-${self.assetCacheHash}`, remoteCache:`vwpCacheRemote-${self.assetCacheHash}`}
    }), () => {
      resolve(swConfigFilename);
    });
  });
}

const copyServiceWorker = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname,'../src/service-worker.js'), "utf-8", function(err, data){
      fs.writeFile((dirPath + '/service-worker.js'), data, 'utf8', function(){
        resolve();
      });
    });
  });
}

const serviceWorker = () => {
  generateSwConfigFile().then((swConfigFilename) => {
    fs.readFile((dirPath + '/service-worker.js'), "utf-8", function(err, data){
      data = data.replace('sw_config.js', swConfigFilename).replace("{{assetCacheHash}}", self.assetCacheHash);
      fs.writeFile((dirPath + '/service-worker.js'), data, 'utf8');
    });
  })
}

const appCache = () => {
  getHashedFile(/local_.*?\.appcache$/).then((localCacheFile) => {
    fs.readFile((dirPath + "/" +localCacheFile), "utf-8", function(err, data){
      data = data.replace("{{cachedFiles}}", self.assetFiles.join('\n')).replace("{{assetCacheHash}}", self.assetCacheHash);
      fs.writeFile((dirPath + "/" + localCacheFile), data, 'utf8');
    });
  });
}

const removeManifestHead = () => {
  getHashedFile(/local_.*?\.appcache$/).then((localCacheFile) => {
    fs.readFile((dirPath + '/index.html'), "utf-8", function(err, data){
      data = data.replace(` manifest="${localCacheFile}"`, '');
      fs.writeFile((dirPath + '/index.html'), data, 'utf8');
    });
  });
}

const exec = () => {
  generateAssetHash()
  .then(() => copyServiceWorker())
  .then(() => {
    serviceWorker();
    appCache();
    removeManifestHead();
  })
}

exports.exec = exec;