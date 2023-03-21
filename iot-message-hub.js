// Copyright 2020 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
 * Options:
 * msg.payload
 * msg.gcp.projectId
 * msg.gcp.region
 * msg.gcp.registryId
 * msg.gcp.deviceId
 */

/* jshint esversion: 8 */
module.exports = function (RED) {
    "use strict";

    const iot = require('./iot-utils.js');

    function GoogleCloudIoTMessageHubNode(config) {
        RED.nodes.createNode(this, config);

        let iotUtils = new iot.IotUtils();

        const STATUS_CONNECTED = {
            fill: "green",
            shape: "dot",
            text: "connected"
        };

        const STATUS_DISCONNECTED = {
            fill: "red",
            shape: "dot",
            text: "disconnected"
        };

        const node = this;

        // Called to send a command to the device.
        async function OnInput(msg) {

            msg.send_status = false;

            // We have been called to send a telemetry message to GCP IoT. 
            if (config.transport === "MQTT") {
                //node.debug(`Sending a telemetry message from device over MQTT`);
                let deviceMqqttClient = iotUtils.connectionPool.get(config.deviceId);

                if (null != deviceMqqttClient && deviceMqqttClient.connected) {
                    this.status(STATUS_CONNECTED);
                    iotUtils.transmitMQTT(RED.util.ensureBuffer(msg.payload), config.deviceId, msg.topic);  // The body of the data is in msg.payload
                    msg.send_status = true;
                }
                else {
                    this.status(STATUS_DISCONNECTED);
                    //no transmit here and no msg send after the iot-message-hub
                }

            }
            else if (config.transport === "HTTP") {
                //node.debug(`Sending a telemetry message from device over HTTP`);
                await iotUtils.transmitHTTP(RED.util.ensureBuffer(msg.payload), config.deviceId);  // The body of the data is in msg.payload

            }
            node.send(msg);
        } // OnInput


        // Called when the node is closed.  Here we want to disconnect the MQTT client if it is set.
        function OnClose() {
            if (config.transport === "MQTT") {  // If the transport is MQTT the close the connection.
                iotUtils.mqttDisconnect(config.deviceId);
            }
            // There is nothing needed to be done for a transport of HTTP.
        } // OnClose

        //Call when a message comes from the Cloud


        // Create the MQTT connection to the IoT Core Bridge
        // and subscribe to the config/commands topics
        if (config.transport === "MQTT") {
            node.status(STATUS_DISCONNECTED);

            const connectionPromise = new Promise((resolve, reject) => {
                try {
                    resolve(iotUtils.mqttConnect(config, RED));
                } catch (error) {
                    console.log("connection error : " + error);
                }

            });

            connectionPromise.then((client) => {

                if (client.connected)
                    this.status(STATUS_CONNECTED);

                client.on('message', (topic, message) => {

                    if (client.connected)
                        this.status(STATUS_CONNECTED);
                    else
                        this.status(STATUS_DISCONNECTED);

                    var obj = {};
                    obj.topic = topic;
                    obj.payload = message;

                    node.send(obj);
                });
            });

        }
        // If the transport is HTTP, nothing need be done.
        node.on('close', OnClose);
        node.on('input', OnInput);


    } // GoogleCloudIoTMessageHubNode

    RED.nodes.registerType("google-cloud-iot message-hub", GoogleCloudIoTMessageHubNode);
};
