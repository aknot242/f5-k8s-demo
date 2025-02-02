function status_by_fqdn(r) {
    r.subrequest('/api/5/http/upstreams', {
            method: 'GET'
        },
        function(res) {
            var output = {};
            var myRe = /[a-zA-Z0-9]+\.f5demo\.com/;
            var needle = r.args["fqdn"];
                function filterUp(item) {
                    if (item.state === "up") {
                        return true;
                    }
                    return false;
                }

            if (res.status == 200) {
                var input = JSON.parse(res.responseBody);
                for (var u in input) {
                  var tmp = myRe.exec(u);
                    if( tmp && tmp[0] === needle ) {
                        var cnt = input[u]['peers'].filter(filterUp).length;
                        if(cnt) {
                            r.return(res.status, JSON.stringify({"status":true}));
                            return;
                        } else {
                            r.return(res.status, JSON.stringify({"status":false}));
                            return;
                        }

                 }
              }
                r.return(res.status, JSON.stringify({"status":false}));                
                return;
            }
            r.return(500);
        });

}

function UpdatePools(r) {
    r.subrequest('/api/5/http/upstreams', {
            method: 'GET'
        },
        function(res) {
            var output = {};

            if (res.status == 200) {
                var input = JSON.parse(res.responseBody);

                function filterUp(item) {
                    if (item.state === "up") {
                        return true;
                    }
                    return false;
                }
                for (var u in input) {
                    if (u != "127.0.0.1") {
                        output[u] = input[u]['peers'].filter(filterUp).length;
                    }
                }
                r.variables.pool = JSON.stringify(output);
                r.return(res.status, JSON.stringify(output));
                return;
            }
            r.return(500);
        });
    //r.return(200,"OK");
}

function GenerateAS3(r) {
    r.subrequest('/api/5/http/keyvals/pools', {
            method: 'GET'
        },
        function(res) {
            var output = {};

            if (res.status == 200) {
                var input = JSON.parse(res.responseBody);
                var myRe = /([a-zA-Z0-9]+)\.f5demo\.com/;
                var template = {
                    "class": "ADC",
                    "schemaVersion": "3.7.0",
                    "id": "NGINXPLUS",
                    "NGINXPlus": {
                        "class": "Tenant",
                        "Apps": {
                            "class": "Application",
                            "template": "http",
                            "serviceMain": {
                                "class": "Service_HTTP",
                                "virtualPort": 8080,
                                "virtualAddresses": [
                                    "10.0.0.200"
                                ],
                                "persistenceMethods": [],
                                "profileMultiplex": {
                                    "bigip": "/Common/oneconnect"
                                }
                            }
                        }
                    }
                };

                for (var u in input) {
                    if (u != "127.0.0.1") {
                        var entry = JSON.parse(input[u]);
                        for (var app in entry) {
                            var tmp = myRe.exec(app);
                            if (tmp) {
                                app = tmp[1];
                            }
                            if (app + "_pool" in template["NGINXPlus"]["Apps"]) {
                                template["NGINXPlus"]["Apps"][app + "_pool"]["members"].push({
                                    "servicePort": 80,
                                    "serverAddresses": [u]
                                });
                            } else {
                                template["NGINXPlus"]["Apps"][app + "_pool"] = {
                                    "class": "Pool",
                                    "members": [{
                                        "servicePort": 80,
                                        "serverAddresses": [u]
                                    }]
                                };
                            }
                        }
                    }
                }
                r.subrequest('/mgmt/shared/appsvcs/declare', {
                        method: 'POST',
                        body: JSON.stringify(template)
                    },
                    function(res) {
                        var output = {};

                        if (res.status == 200) {
                            var input = JSON.parse(res.responseBody);
                            r.return(res.status, JSON.stringify(input));
                            return;
                        }
                        r.return(res.status, res.responseBody);
                        //   r.return(500);
                    });

                //       r.return(res.status, JSON.stringify(template));
                //       return;
            }
            r.return(500);
        });
    //r.return(200,"OK");
}

function version(r) {
    r.subrequest('/api/5/nginx', {
        method: 'GET'
    }, function(res) {
        if (res.status != 200) {
            r.return(res.status);
            return;
        }

        var json = JSON.parse(res.responseBody);
        r.return(200, json.version);
    });
}

function GenerateAS3Dns(r) {
    r.subrequest('/api/5/http/keyvals/pools', {
            method: 'GET'
        },
        function(res) {
            var output = {};

            if (res.status == 200) {
                var input = JSON.parse(res.responseBody);
                var myRe = /([a-zA-Z0-9]+)\.f5demo\.com/;
var template = {
    "class": "ADC",
    "schemaVersion": "3.7.0",
    "id": "NGINXPLUS",
    "Common": {
        "class": "Tenant",
        "Shared": {
            "class": "Application",
            "template": "shared",
            "myMonitor": {
                "class": "GSLB_Monitor",
                "monitorType": "tcp",
                "send": ""
            },
            "AS3DataCenter": {
                "class": "GSLB_Data_Center"
            },
            "AS3Server": {
                "class": "GSLB_Server",
                "dataCenter": {
                    "use": "AS3DataCenter"
                },
                "devices": [{
                    "address": "10.1.10.240",
                    "addressTranslation": "10.1.10.240"
                }],
                "virtualServers": []
            }
        }
    },
    "NGINXPlusDNS": {
        "class": "Tenant",
        "DNS": {
            "class": "Application",
            "template": "generic"
        }
    }
};

var output = {};
var virtualServers = {};
var dataCenters = {"10.1.20.54":"dc1","10.1.20.55":"dc2"}
		
var x = 0;
for (var u in input) {

    virtualServers[u] = x.toString();
    var data_center = dataCenters[u];    
    x++;
    template["Common"]["Shared"]["AS3Server"]["virtualServers"].push({
        "address": u,
        "addressTranslation": u,
        "addressTranslationPort": 443,
        "port": 443,
        "monitors": [ {"use":"myMonitor"}]
    });
    if (u != "127.0.0.1") {
        var entry = JSON.parse(input[u]);
        for (var app in entry) {            
            var cnt = entry[app];
                            var tmp = myRe.exec(app);
                            if (tmp) {
                                app = tmp[1];
                            }            
            var member = {
                "server": {
                    "use": "/Common/Shared/AS3Server"
                },
                "virtualServer": virtualServers[u]
            };
            if (cnt == 0) {
                continue;
            }
            if (data_center + "_" + app + "_pool" in template["NGINXPlusDNS"]["DNS"]) {
                template["NGINXPlusDNS"]["DNS"][data_center + "_" + app + "_pool"]["members"].push(member);
            } else {
                template["NGINXPlusDNS"]["DNS"][data_center + "_" + app + "_pool"] = {
                    "class": "GSLB_Pool",
                    "members": [member],
                    "resourceRecordType": "A"
                };
            }
            if (app + "_domain" in template["NGINXPlusDNS"]["DNS"]) {
                template["NGINXPlusDNS"]["DNS"][app + "_domain"]["pools"].push({
                    "use": data_center + "_" + app + "_pool"
                });
            } else {
                template["NGINXPlusDNS"]["DNS"][app + "_domain"] = {
                    "class": "GSLB_Domain",
                    "domainName": app + ".f5demo.com",
                    "resourceRecordType": "A",
                    "pools": [{
                        "use": data_center + "_" + app + "_pool"
                    }]
                };
            }


        }
    }
}
                r.subrequest('/mgmt/shared/appsvcs/declare', {
                        method: 'POST',
                        body: JSON.stringify(template)
                    },
                    function(res) {
                        var output = {};

                        if (res.status == 200) {
                            var input = JSON.parse(res.responseBody);
                            r.return(res.status, JSON.stringify(input));
                            return;
                        }
                        r.return(res.status, res.responseBody);
                        //   r.return(500);
                    });

            }
            r.return(500);
        });
    //r.return(200,"OK");
}


function GenerateCloudDns(r) {
    r.subrequest('/api/5/http/keyvals/pools', {
            method: 'GET'
        },
        function(res) {
            var output = {};

            if (res.status == 200) {
                var input = JSON.parse(res.responseBody);
                var myRe = /([a-zA-Z0-9]+)\.f5demo\.com/;
var template = {
    "account_id": "{{ACCOUNT_ID}}",
    "catalog_id": "c-aaQnOrPjGu",
    "plan_id": "p-__free_dns",
    "service_type": "gslb",
    "service_instance_name": "{{SERVICE_INSTANCE_NAME}}",
    "configuration": {
        "gslb_service": {
            "load_balanced_records": {
            },
            "pools": {
            },
            "virtual_servers": {
            },
            "zone": "{{GSLB_ZONE}}"
        },
        "schemaVersion": "0.1"
    }

};
if ("account_id" in r.args) {
    template["account_id"] = r.args["account_id"];
}
if ("gslb_zone" in r.args) {
    template["configuration"]["gslb_service"]["zone"] = r.args["gslb_zone"];
    template["service_instance_name"] = r.args["gslb_zone"];    
}
		
var output = {};
var virtualServers = {};
var publicIps = {"10.1.20.54":"192.0.2.10","10.1.20.55":"192.0.2.11"}
var dataCenters = {"10.1.20.54":"dc1","10.1.20.55":"dc2"}
var x = 0;
for (var u in input) {

    virtualServers[u] = x;

    var data_center = dataCenters[u];
    x++;

    if (u != "127.0.0.1") {
        var entry = JSON.parse(input[u]);
        for (var app in entry) {
	    var cnt = entry[app];
	    if( cnt == 0 ) {
		continue;
	    }
	    var pool_name = "pools_" + data_center + "_" + app;
	    var ip_endpoint = "ipEndpoints_" + data_center + "_" + app + "_instance_";
            if ( !(app in template["configuration"]["gslb_service"]["load_balanced_records"])) {
		template["configuration"]["gslb_service"]["load_balanced_records"][app] =  {
                    "aliases": [
			app
                    ],
                    "display_name": app,
                    "enable": true,
                    "persist_cidr_ipv4": 24,
                    "persist_cidr_ipv6": 56,
                    "persistence": true,
                    "persistence_ttl": 3600,
                    "proximity_rules": [
                        {
                            "region": "global",
                            "pool": pool_name,
                            "score": 100
                        }
                    ],
                    "rr_type": "A"
                }
            } else {
		template["configuration"]["gslb_service"]["load_balanced_records"][app]["proximity_rules"].push(                        {
                            "region": "global",
                            "pool": pool_name,
                            "score": 100
                });
	    }
            if ( !(pool_name in template["configuration"]["gslb_service"]["pools"])) {
		template["configuration"]["gslb_service"]["pools"][pool_name] = {
                    "display_name": data_center + "_" + app,
                    "enable": true,
                    "load_balancing_mode": "round-robin",
                    "max_answers": 1,
                    "members": [
                        {
                            "virtual_server": ip_endpoint + virtualServers[u]
                        }
                    ],
                    "rr_type": "A",
                    "ttl": 30
                }

	    } else {
		template["configuration"]["gslb_service"]["pools"][pool_name]["members"].push({"virtual_server":ip_endpoint + virtualServers[u]});
	    }
	    template["configuration"]["gslb_service"]["virtual_servers"][ip_endpoint + virtualServers[u]] =  {
                    "display_name": "dc1_app001_instance_1",
                    "address": publicIps[u],
                    "port": 80
                }
        }
    }
}
//		r.return(res.status, JSON.stringify(template));
//                return;
                r.subrequest('/v1/svc-subscription/subscriptions/' + r.args["subscription_id"], {
                        method: 'PUT',
                        body: JSON.stringify(template)
                    },
                    function(res) {
                        var output = {};

                        if (res.status == 200) {
                            var input = JSON.parse(res.responseBody);
                            r.return(res.status, JSON.stringify(input));
                            return;
                        }
                        r.return(res.status, res.responseBody);
                        //   r.return(500);
                    });

            }
            r.return(500);
        });
    //r.return(200,"OK");
}

