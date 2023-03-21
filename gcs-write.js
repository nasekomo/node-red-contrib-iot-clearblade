/**
 * Copyright 2019 Google Inc.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * The node type is "gcs-write".
 * 
 * msg.payload  = data to be written.
 * msg.filename = file name to be written.  The file name will be of the form gs://[BUCKET]/[FILE_PATH]
 * msg.contentType = Content type setting for data (optional)
 * 
 * Note that msg.filename is optional.  If the configuration filename is specified, that can be used.  If msg.filename
 * AND the configuration filename are both specified, then msg.filename will be used.  It is an error to not
 * supply at least one.
 * 
 * If we specify a msg.contentType, then that will be used for the MIME type of the file.  If we don't but we do have
 * a configuration of a content type, then we'll use that.  If neither, then no content type is specified.
 * 
 */
/* jshint esversion: 8 */
module.exports = function(RED) {
    "use strict";
    const NODE_TYPE = 'google-cloud-gcs-write';
    const {Storage} = require('@google-cloud/storage');

    /**
     * Called when a new instance of the node is created.
     * @param {*} config 
     */
    function GCSWriteNode(config) {
        // The config contains the properties defined in the default object in the HTML or modified through configuration in the editor.
        //

        RED.nodes.createNode(this, config);  // Required by the Node-RED spec.

        let storage;
        let credentials = null;
        if (config.account) {
            credentials = GetCredentials(config.account);
        }
        const keyFilename = config.keyFilename;
        const node = this;
        const fileName_options = config.filename.trim();
        const contentType_options = config.contentType.trim();

        /**
         * Extract JSON service account key from "google-cloud-credentials" config node.
         */
        
        function GetCredentials(node) {
            return JSON.parse(RED.nodes.getCredentials(node).account);
        }
        
        /**
         * Receive an input message for processing.
         * @param {*} msg 
         */
        function Input(msg) {
            let gsURL;

            if (!msg.filename && fileName_options === "") { // If no msg.filename AND no options for filename, then that would be an error.
                node.error(`No filename found in msg.filename and no file name configured (${fileName_options})`);
                return;
            }
            if (!msg.payload) {
                node.error('No data found in msg.payload');
                return;
            }

            // If msg.filename is present, use that.  If not present then use the configuration filename.
            if (msg.filename) {
                gsURL = RED.util.ensureString(msg.filename).trim();
            }
            else {
                gsURL = fileName_options;
            }

            // At this point we have a URL of the form gs://[BUCKET]/[FILENAME].  We now want
            // to parse this out and get the bucket and file.

            const parts = gsURL.match(/gs:\/\/([^\/]*)\/(.*)$/);
            if (parts === null || parts.length != 3) {
                node.error(`Badly formed URL: ${gsURL}`);
                return;
            }

            const bucketName = parts[1];
            const fileName   = parts[2];

            const bucket = storage.bucket(bucketName); // Get access to the bucket
            const file   = bucket.file(fileName);      // Model access to the file in the bucket

            const writeStreamOptions = {
                resumable: false
            }; // https://googleapis.dev/nodejs/storage/latest/global.html#CreateWriteStreamOptions

            // If we have a msg.contentType field, use it.  If we don't but we have a contentType set in options, use
            // that.  Otherwise don't supply a content type.
            if (msg.contentType) {
                writeStreamOptions.contentType = RED.util.ensureString(msg.contentType);
            } else if (contentType_options !== "") {
                writeStreamOptions.contentType = contentType_options;
            }

            const writeStream = file.createWriteStream(writeStreamOptions); // Create a write stream to the file.

            writeStream.on('error', (err) => {
                node.error(`writeStream error: ${err.message}`,msg);
            });
            writeStream.on('finish', () => { // When we receive the indication that the write has finished, signal the end.
                node.send(msg);
            });
            writeStream.end(msg.payload); // Write the data to the object.

        } // Input


        /**
         * Cleanup this node.
         */
        function Close() {
        }


        // We must have EITHER credentials or a keyFilename.  If neither are supplied, that
        // is an error.  If both are supplied, then credentials will be used.
        if (credentials) {
            storage = new Storage({
                "credentials": credentials
            });
        } else if (keyFilename) {
            storage = new Storage({
                "keyFilename": keyFilename
            });
        } else {
            storage = new Storage({});
        }

        node.on('input', Input);
        node.on('close', Close);
    } // GCSWriteNode

    RED.nodes.registerType(NODE_TYPE, GCSWriteNode); // Register the node.
};