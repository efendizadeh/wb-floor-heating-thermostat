var config =
    {
        settings: {
            hysteresis: 0.5,
            tempHighThreshold: 31,
        },

        thermostats: {
//Edit below add thermostat and releated relay channel/themperature sensor
            thermostat_1: [
                {
                    relayDevice: "wb-mr3_19",
                    relay: "K1",
                    sensorDevice: "wb-m1w2_99",
                    sensor: "External Sensor 1",
                    enabled: true,
                    sensorDeviceError: false,
                    sensorError: false,
                    hysteresisUp: false,
                },
                {
                    relayDevice: "wb-mr3_19",
                    relay: "K2",
                    sensorDevice: "wb-m1w2_41",
                    sensor: "External Sensor 1",
                    enabled: true,
                    sensorDeviceError: false,
                    sensorError: false,
                    hysteresisUp: false,
                },
            ],

            thermostat_2: [
                {
                    relayDevice: "wb-mr3_20",
                    relay: "K1",
                    sensorDevice: "wb-m1w2_161",
                    sensor: "External Sensor 1",
                    enabled: true,
                    sensorDeviceError: false,
                    sensorError: false,
                    hysteresisUp: false,
                },
                {
                    relayDevice: "wb-mr3_20",
                    relay: "K2",
                    sensorDevice: "wb-m1w2_63",
                    sensor: "External Sensor 1",
                    enabled: true,
                    sensorDeviceError: false,
                    sensorError: false,
                    hysteresisUp: false,
                },
            ],

            thermostat_3: [
                {
                    relayDevice: "wb-mr3_43",
                    relay: "K2",
                    sensorDevice: "wb-m1w2_81",
                    sensor: "External Sensor 1",
                    enabled: true,
                    sensorDeviceError: false,
                    sensorError: false,
                    hysteresisUp: false,
                },
            ],
            
//END CONFIGURATION            
        }
    };


var vDeviceBodyTemplate =
    {
        title: "",
        cells: {
            "Enable": {
                title: "Heater on",
                type: "switch",
                value: false,
                order: 10,
            },
            "Target temperature": {
                title: "Target temperature",
                type: "range",
                value: 10,
                min: 10,
                max: 30,
                order: 20,
            },
            "Current temperature": {
                title: "Current temperature",
                type: "temperature",
                value: 0.0,
                order: 30,
            },
        }
    };


//Initialize
(function () {
    //Initialize helper structures (скучаю по указателям :(((( )
    config.params = {};
    config.params.sensorArr = [];
    config.params.sensorThermostatArr = [];
    config.params.sensorDeviceEntityArr = [];

    Object.keys(config.thermostats)
        .forEach(function (thermostat) {
            config.thermostats[thermostat].forEach(function (entity) {
                config.params.sensorArr[config.params.sensorArr.length] = entity.sensorDevice + "/" + entity.sensor;
                config.params.sensorThermostatArr[entity.sensorDevice + "/" + entity.sensor] = thermostat;
                config.params.sensorDeviceEntityArr[entity.sensorDevice] = entity;
            });
        });

    //Initialize VirtualDevices
    Object.keys(config.thermostats)
        .forEach(function (thermostat) {
            vDeviceBodyTemplate.title = "fh-" + thermostat;
            defineVirtualDevice(vDeviceBodyTemplate.title, vDeviceBodyTemplate);
        });

    //Initialize device error rule
    var errorSensorDevice = [];
    config.params.sensorArr
        .forEach(function (sensor) {
            errorSensorDevice[errorSensorDevice.length] = sensor + "#error";
        });

    defineRule("fh-device-error-rule", {
        whenChanged: errorSensorDevice,
        then: function (newValue, devName, cellName) {
            var entity = config.params.sensorDeviceEntityArr[devName];
            if (newValue !== "") {
                entity.sensorDeviceError = true;
                if (dev[entity.relayDevice][entity.relay]) {
                    dev[entity.relayDevice][entity.relay] = false;
                }
            } else {
                entity.sensorDeviceError = false;
            }
        }
    });

    //Initialize sensor error rule
    var errorSensor = [];
    config.params.sensorArr
        .forEach(function (sensor) {
            errorSensor[errorSensor.length] = sensor + " OK";
        });

    defineRule("fh-sensor-error-rule", {
        whenChanged: errorSensor,
        then: function (newValue, devName, cellName) {
            var entity = config.params.sensorDeviceEntityArr[devName];
            if (!newValue) {
                entity.sensorError = true;
                if (dev[entity.relayDevice][entity.relay]) {
                    dev[entity.relayDevice][entity.relay] = false;
                }
            } else {
                entity.sensorError = false;
            }
        }
    });

    //Initialize vDevice current temperature update rule
    defineRule("fh-current-temperature-value-rule", {
        whenChanged: config.params.sensorArr,
        then: function (newValue, devName, cellName) {
            var thermostat = config.params.sensorThermostatArr[devName + "/" + cellName];
            updateCurrentTemperatureValue(thermostat);
        }
    });

    //vDevice on/off rule
    var thermostatEnable = [];
    Object.keys(config.thermostats)
        .forEach(function (thermostat) {
            thermostatEnable[thermostatEnable.length] = "fh-" + thermostat + "/Enable";
        });

    defineRule("fh-on-off-rule", {
        whenChanged: thermostatEnable,
        then: function (newValue, devName, cellName) {
            var thermostat = devName.substring(3);
            config.thermostats[thermostat]
                .forEach(function (entity) {
                    thermostatLogic(dev[entity.sensorDevice][entity.sensor], entity.sensorDevice, entity.sensor);
                });
        }
    });

    //Control logic
    defineRule("fh-control-rule", {
        whenChanged: config.params.sensorArr,
        then: function (currentTemp, devName, cellName) {
            thermostatLogic(currentTemp, devName, cellName);
        }
    });

    function thermostatLogic(currentTemp, devName, cellName) {
        var thermostat = config.params.sensorThermostatArr[devName + "/" + cellName];
        var entity = config.params.sensorDeviceEntityArr[devName];

        if (!dev["fh-" + thermostat]["Enable"]) {
            if (dev[entity.relayDevice][entity.relay]) {
                dev[entity.relayDevice][entity.relay] = false;
            }
            return;
        }

        if (!entity.enabled || entity.sensorDeviceError || entity.sensorError) {
            if (dev[entity.relayDevice][entity.relay]) {
                dev[entity.relayDevice][entity.relay] = false;
            }
            return;
        }

        var targetTemp = dev["fh-" + thermostat]["Target temperature"];
        if (targetTemp > 30) {
            targetTemp = 30;
        }


        if (currentTemp >= config.settings.tempHighThreshold) {
            if (dev[entity.relayDevice][entity.relay]) {
                dev[entity.relayDevice][entity.relay] = false;
            }
            return;
        }

        if (entity.hysteresisUp) {
            if (currentTemp >= targetTemp + config.settings.hysteresis) {
                entity.hysteresisUp = false;
                if (dev[entity.relayDevice][entity.relay]) {
                    dev[entity.relayDevice][entity.relay] = false;
                }
            } else {
                if (!dev[entity.relayDevice][entity.relay]) {
                    dev[entity.relayDevice][entity.relay] = true;
                }
            }
        } else {
            if (currentTemp <= targetTemp - config.settings.hysteresis) {
                entity.hysteresisUp = true;
                if (!dev[entity.relayDevice][entity.relay]) {
                    dev[entity.relayDevice][entity.relay] = true;
                }
            } else {
                if (dev[entity.relayDevice][entity.relay]) {
                    dev[entity.relayDevice][entity.relay] = false;
                }
            }
        }
    }

    function updateCurrentTemperatureValue(thermostat) {
        var sensorCount = 0;
        var sensorValue = 0;

        config.thermostats[thermostat]
            .forEach(function (entity) {
                sensorCount++;
                sensorValue += dev[entity.sensorDevice][entity.sensor];
                //TODO: check returning value for correctness (float) otherwise disable output relay
            });

        if (sensorCount > 0) {
            sensorValue = sensorValue / sensorCount;
        }
        sensorValue = +(Math.round(sensorValue + "e+2") + "e-2");
        dev["fh-" + thermostat]["Current temperature"] = sensorValue;
    }

    Object.keys(config.thermostats)
        .forEach(function (thermostat) {
            updateCurrentTemperatureValue(thermostat);
        });
})();
