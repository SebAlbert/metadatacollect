#!/usr/bin/env node

// const fs = require('fs');
const shell = require('shelljs');
const tmp = require('tmp');
// const unzipper = require('unzipper');

function processDir(dir) {
    console.log("processDir(" + dir + ")");
    var exiftoolOutput = shell.exec(
        'exiftool -json -u -U -n -g -r. -m -ext "*" "' + dir + '"',
        {silent: true}
    ).stdout;

    var exiftoolMetadata = exiftoolOutput.length > 0 ?
        JSON.parse(exiftoolOutput) : [];

    return Promise.all(exiftoolMetadata.map(function(file) {
            file.md5sum = shell.exec('md5sum -b "' + file.SourceFile + '"',
                    {silent: true}).stdout.split(/ /)[0];
            if (file.File.MIMEType && file.File.MIMEType.match(/^audio\//) || file.File.MIMEType == 'video/mp4')
                file.chromaprint = JSON.parse(shell.exec('fpcalc -json "' + file.SourceFile + '"',
                    {silent: true}).stdout);
            if (file.File.MIMEType == 'application/zip') {
                const tmpDir = tmp.dirSync({unsafeCleanup: true});
                return new Promise(function(resolve, reject) {
                    // unzipper does not work with some zip files :(
                    /*var extractor = new unzipper.Extract({path: tmpDir.name});
                    extractor.on('error', function(err) {
                            console.log("Error!" + tmpDir.name);
                            console.log(err);
                        });
                    fs.createReadStream(file.SourceFile)
                        .on('error', function(err) {
                            console.log("Error!" + tmpDir.name);
                            console.log(err);
                        })
                        .pipe(extractor)
                        .on('close', function() {
                            processDir(tmpDir.name)
                            .then(function(d, e) {
                                console.log("file: " + JSON.stringify(file));
                                file.zipContents = d;
                                console.log("d: " + JSON.stringify(d));
                                resolve(file);
                            });
                        })
                        ;
                    });*/
                    shell.exec('unzip "' + file.SourceFile + '" -d "' +
                            tmpDir.name + '"', {silent: true});
                    processDir(tmpDir.name)
                    .then(function(d) { file.zipContents = d; resolve(file)});
                });
            } else if (file.File.MIMEType == 'application/x-gzip') {
                const tmpDir = tmp.dirSync({unsafeCleanup: true});
                return new Promise(function(resolve, reject) {
                    shell.exec('cp -p "' + file.SourceFile + '" "' +
                            tmpDir.name + '"', {silent: true});
                    if (shell.exec('gunzip "' + tmpDir.name + '/' +
                            file.File.FileName + '"', {silent: true}).code === 0)
                        processDir(tmpDir.name)
                        .then(function(d) { file.zipContents = d; resolve(file)});
                    else resolve(file);
                });
            } else if (file.File.MIMEType == 'application/x-tar') {
                const tmpDir = tmp.dirSync({unsafeCleanup: true});
                return new Promise(function(resolve, reject) {
                    shell.exec('tar xf "' + file.SourceFile + '" -p -C "' +
                            tmpDir.name + '"', {silent: true});
                    processDir(tmpDir.name)
                    .then(function(d) { file.tarContents = d; resolve(file)});
                });
            } else return Promise.resolve(file);
        }));
}

const dir = process.argv.length > 2 ? process.argv[2] : process.cwd();
processDir(dir)
.then(function(result) { console.log(JSON.stringify(result, null, '  ')); });
