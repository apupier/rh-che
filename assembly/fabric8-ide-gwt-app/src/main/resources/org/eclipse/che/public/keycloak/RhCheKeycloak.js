/*
 * Copyright (c) 2016-2018 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */
const osio_msg_provisioning = "Creating your <strong>OpenShift</strong> account";
const osio_msg_linking_account = "Linking your <strong>OpenShift</strong> account";
const osio_msg_setting_up_namespaces = "Setting up your <strong>OpenShift.io</strong> environment";
const osio_msg_error_no_resources = "Resources required to use <strong>Eclipse Che</strong> could not be granted to the user.<br>You may want to <a href='' onclick='return osioProvisioningLogout()'>use a different account</a><br>or contact support.";
const osio_msg_started = "<strong>Eclipse Che</strong> is loading";

const telemetry_event_enter_che_dashboard = 'enter che dashboard';
const telemetry_event_provision_user_for_che = 'provision user for che';
const telemetry_event_display_provisioning_page_for_che = 'display provisioning page for che';
const telemetry_event_enter_provisioning_page_for_che = 'enter provisioning page for che';
const telemetry_event_trigger_account_linking = 'trigger openshift account linking for che';
const telemetry_event_setup_namespaces = 'setup namespaces for che';

const provisioningWaitDelay = 1000;
const provisioningTimeout = 2 * 60 * 1000;

function provision_osio(redirect_uri) {
    var provisioningWindow = window.open('https://developers.redhat.com/auth/realms/rhd/protocol/openid-connect/logout?redirect_uri=' + encodeURIComponent(redirect_uri), 'osio_provisioning');
    if(! provisioningWindow) {
        setStatusMessage("User provisioning should happen in a separate window.<br/> \
        Please enable popups, before retrying");
    } else {
        track(telemetry_event_enter_provisioning_page_for_che, { user: osioUserToApprove });
        sessionStorage.setItem('osio-provisioning-notification-message', osio_msg_provisioning);
        sessionStorage.setItem('osio-provisioning', new Date().getTime());
        window.blur();
        window.focus();
        window.location.reload();
    }
}

var osioProvisioningLogout;
var osioProvisioningURL;
var osioUserToApprove;
var setStatusMessage;

function track(eventName, attributes) {
    if (window.analytics) {
        if (attributes) {
            analytics.track(eventName, attributes);
        } else {
            analytics.track(eventName);
        }
    }
}

function initAnalytics(writeKey){

    // Create a queue, but don't obliterate an existing one!
    var analytics = window.analytics = window.analytics || [];

    // If the real analytics.js is already on the page return.
    if (analytics.initialize) return;

    // If the snippet was invoked already show an error.
    if (analytics.invoked) {
        if (window.console && console.error) {
            console.error('Segment snippet included twice.');
        }
        return;
    }

    // Invoked flag, to make sure the snippet
    // is never invoked twice.
    analytics.invoked = true;

    // A list of the methods in Analytics.js to stub.
    analytics.methods = [
        'trackSubmit',
        'trackClick',
        'trackLink',
        'trackForm',
        'pageview',
        'identify',
        'reset',
        'group',
        'track',
        'ready',
        'alias',
        'debug',
        'page',
        'once',
        'off',
        'on'
        ];

    // Define a factory to create stubs. These are placeholders
    // for methods in Analytics.js so that you never have to wait
    // for it to load to actually record data. The `method` is
    // stored as the first argument, so we can replay the data.
    analytics.factory = function(method){120000
        return function(){
            var args = Array.prototype.slice.call(arguments);
            args.unshift(method);
            analytics.push(args);
            return analytics;
        };
    };

    // For each of our methods, generate a queueing stub.
    for (var i = 0; i < analytics.methods.length; i++) {
        var key = analytics.methods[i];
        analytics[key] = analytics.factory(key);
    }

    // Define a method to load Analytics.js from our CDN,
    // and that will be sure to only ever load it once.
    analytics.load = function(key, options){
        // Create an async script element based on your key.
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://cdn.segment.com/analytics.js/v1/'
            + key + '/analytics.min.js';

        // Insert our script next to the first script element.
        var first = document.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(script, first);
        analytics._loadOptions = options;
    };

    // Add a version to keep track of what's in the wild.
    analytics.SNIPPET_VERSION = '4.1.0';

    // Load Analytics.js with your key, which will automatically
    // load the tools you've enabled for your account. Boosh!
    analytics.load(writeKey);

    return;
};

(function( window, undefined ) {
    var osioApiURL;
    var osioAuthURL;

    function createPromise() {
        var p = {
                setSuccess: function(result) {
                    p.success = true;
                    p.result = result;
                    if (p.successCallback) {
                        p.successCallback(result);
                    }
                },

                setError: function(result) {
                    p.error = true;
                    p.result = result;
                    if (p.errorCallback) {
                        p.errorCallback(result);
                    }
                },

                promise: {
                    success: function(callback) {
                        if (p.success) {
                            callback(p.result);
                        } else if (!p.error) {
                            p.successCallback = callback;
                        }
                        return p.promise;
                    },
                    error: function(callback) {
                        if (p.error) {
                            callback(p.result);
                        } else if (!p.success) {
                            p.errorCallback = callback;
                        }
                        return p.promise;
                    }
                }
        }
        return p;
    }

    function get(url, token) {
        return new Promise((resolve, reject) => {
            var request = new XMLHttpRequest();
            request.onerror = request.onabort = function(error) {
                reject(error);
            };
            request.onload = function() {
                if (this.status >= 200 && this.status < 300 || this.status === 304) {
                    resolve(this)
                } else {
                    reject(this);
                }
            };

            request.open("GET", url, true);
            if (token) {
                request.setRequestHeader("Authorization", "Bearer " + token);
            }
            request.send();
        });
    }

    function post(url, body, token) {
        return new Promise((resolve, reject) => {
            var request = new XMLHttpRequest();
            request.onerror = request.onabort = function(error) {
                reject(error);
            };
            request.onload = function() {
                if (this.status >= 200 && this.status < 300 || this.status === 304) {
                    resolve(this)
                } else {
                    reject(this);
                }
            };

            request.open("POST", url, true);
            if (token) {
                request.setRequestHeader("Authorization", "Bearer " + token);
            }
            request.send(body);
        });
    }

    function performAccounkLinking(keycloak) {
        return get(osioApiURL + "/users?filter%5Busername%5D=" + encodeURIComponent(keycloak.tokenParsed.preferred_username), keycloak.token)
        .then((request) => {
            data = JSON.parse(request.responseText).data;
            if (data && data[0]) {
                return data[0].attributes.cluster;
            } else {
                sessionStorage.removeItem('osio-provisioning-notification-message');
                return Promise.reject("cannot find cluster for user: " + keycloak.tokenParsed.preferred_username)
            }
        })
        .then((cluster) => {
            return get(osioAuthURL + "/token?for=" + encodeURIComponent(cluster), keycloak.token)
            .then((request) => {
                sessionStorage.removeItem('osio-provisioning-notification-message');
                return request;
            },(request) => {
                json = JSON.parse(request.responseText);
                if (request.status == 401 &&
                        json &&
                        json.errors &&
                        json.errors[0] &&
                        json.errors[0].detail == "token is missing") {
                    sessionStorage.removeItem('osio-provisioning-notification-message');
                    setStatusMessage(osio_msg_linking_account);
                    return get(osioAuthURL + "/token/link?for=" + encodeURIComponent(cluster) + "&redirect=" + encodeURIComponent(window.location), keycloak.token)
                    .then((request) => {
                        var json = JSON.parse(request.responseText);
                        if (json && json.redirect_location) {
                            track(telemetry_event_trigger_account_linking, { 'redirect location': json.redirect_location });
                            sessionStorage.setItem('osio-provisioning-notification-message', osio_msg_linking_account);
                            window.location.replace(json.redirect_location);
                            return new Promise((resolve, reject) => {});
                        } else {
                            sessionStorage.removeItem('osio-provisioning-notification-message');
                            return Promise.reject("Cannot get account linking page for user: " + keycloak.tokenParsed.preferred_username)
                        }
                    });
                } else {
                    console.log("Error while checking account linking", request);
                    setStatusMessage("Error while checking account linking");
                    sessionStorage.removeItem('osio-provisioning-notification-message');
                    return Promise.reject("Error while checking account linking: " + request.responseText);
                }
            });
        });
    }

    function setUpNamespaces(keycloak) {
        return get(osioApiURL + "/user/services", keycloak.token)
        .catch(function (error) {
            sessionStorage.removeItem('osio-provisioning-notification-message');
            track(telemetry_event_setup_namespaces);
            setStatusMessage(osio_msg_setting_up_namespaces);
            return get(osioApiURL + "/user", keycloak.token)
            .then((request) => checkNamespacesCreated(keycloak, new Date().getTime() + 30000));
        });

    }

    function checkNamespacesCreated(keycloak, timeLimit) {
        setStatusMessage(osio_msg_setting_up_namespaces);
        return get(osioApiURL + "/user/services", keycloak.token)
        .catch((request) => {
            if (new Date().getTime() < timeLimit) {
                return new Promise((resolve, reject) => {
                    setTimeout(function(){
                        resolve(checkNamespacesCreated(keycloak, timeLimit));
                    }, 2000);
                })
            } else {
                return Promise.reject("Error when checking namespaces: " + request.responseText);
            }
        });
    }

    function identifyUser(keycloak) {
        if (window.analytics) {
            return get(osioApiURL + "/user", keycloak.token)
            .then((request) => {
                try {
                    var json = JSON.parse(request.response);
                    if (json && json.data) {
                        var user = json.data;
                        var traits = {
                                avatar: user.attributes.imageURL,
                                email: user.attributes.email,
                                username: user.attributes.username,
                                website: user.attributes.url,
                                name: user.attributes.fullName,
                                description: user.attributes.bio
                        }
                        if (localStorage['openshiftio.adobeMarketingCloudVisitorId']) {
                            traits.adobeMarketingCloudVisitorId = localStorage['openshiftio.adobeMarketingCloudVisitorId'];
                        }
                        analytics.identify(user.id, traits);
                        return true;
                    } else {
                        post('/api/fabric8-che-analytics/error', "Invalid user data for user " + keycloak.tokenParsed.sub + "\nResponse body: " + request.responseText);
                        return true;
                    }
                } catch(err) {
                    post('/api/fabric8-che-analytics/error', "Exception when parsing the user data for user " + keycloak.tokenParsed.sub + " :" + err + "\nResponse body: " + request.responseText);
                    return true;
                }
            })
            .catch(function(request) {
                post('/api/fabric8-che-analytics/error', "Error when getting user informations: status code: " + request.status + " - Response body: " + request.responseText);
                    return true;
            });
        } else {
            post('/api/fabric8-che-analytics/warning', "Following user accessed the Dashboard without being fully identified inside Telemetry: " + keycloak.tokenParsed.sub);
            return Promise.resolve(true);
        }
    }

    function identifyUserWithId(keycloak) {
        if(window.analytics) {
            analytics.identify(keycloak.tokenParsed.sub);
        } else {
            post('/api/fabric8-che-analytics/warning', "Following user accessed the Dashboard without being identified by ID inside Telemetry: " + keycloak.tokenParsed.sub);
        }
    }
    
    function userNeedsApproval(error_description) {
        try {
            var data = JSON.parse(error_description);
            if (data && (data.status == 403 || data.status == 401)) {
                json = JSON.parse(data.response);
                if (json &&
                        json.errors &&
                        json.errors[0]) {
                    var error = json.errors[0];

                    if(error.code == "unauthorized_error" &&
                            error.detail.endsWith("' is not approved")) {
                        return error.detail.replace("' is not approved", "")
                        .replace("user '", "");
                    }
                    if(error.code == "forbidden_error" && error.detail
                            && error.detail.startsWith("user is not authorized to access OpenShift")) {
                        if (error.detail.startsWith("user is not authorized to access OpenShift: ")) {
                            return error.detail.replace("user is not authorized to access OpenShift: ", "");
                        } else {
                            return "unknown";
                        }
                    }
                } 
            }
        } catch(err) {
        }
    }

    var scripts = document.getElementsByTagName("script");
    var originalKeycloakScript;
    var provisioningPage;
    for(var i=0; i<scripts.length;++i) {
        if (scripts[i].src && scripts[i].src.endsWith("RhCheKeycloak.js")) {
            originalKeycloakScript = scripts[i].src.replace("RhCheKeycloak.js", "OIDCKeycloak.js");
            provisioningPage = scripts[i].src.replace("RhCheKeycloak.js", "provision.html");
            console.log("originalKeycloakScript = ", originalKeycloakScript);
            console.log("OSIO provisioning page = ", provisioningPage);
            break;
        }
    }

    if (! originalKeycloakScript) {
        throw "Cannot find current script named 'RhCheKeycloak.js'";
    }

    request = new XMLHttpRequest();
    request.open('GET', originalKeycloakScript, false);
    request.send();

    source = request.responseText;
    eval(source);
    var originalKeycloak = window.Keycloak;
    window.Keycloak = function(config) {
        kc = originalKeycloak(config);
        if (config && !config.oidcProvider) {
            return kc;
        }
        
        osioAuthURL = config.oidcProvider;
        
        if (osioAuthURL.includes('.prod-preview.')) {
            osioApiURL = 'https://api.prod-preview.openshift.io/api';
            osioProvisioningURL = "https://manage.openshift.com/openshiftio?cluster=starter-us-east-2a";
        } else {
            osioApiURL = 'https://api.openshift.io/api';
            osioProvisioningURL = "https://manage.openshift.com/register/openshiftio_create";
        }

        osioProvisioningLogout = function() {
            kc.logout();
            return false;
        };
        var originalInit = kc.init;
        kc.init = function (initOptions) {
            var finalPromise = createPromise();

            var isInCheDashboard = document.getElementsByClassName('ide-page-loader-content').length > 0;
            if (isInCheDashboard) {
                var pageLoaderDiv = document.getElementsByClassName('ide-page-loader-content')[0];
                var loaderImage = pageLoaderDiv.getElementsByTagName("img")[0];
                if (loaderImage) {
                    loaderImage.src = "/dashboard/assets/branding/loader.svg";
                }

                var statusDiv = document.createElement('div');
                statusDiv.style = "text-align: center; position: fixed; top: 0; bottom: 0; left: 0; right: 0; margin: auto; height: 100%;";
                statusDiv.innerHTML = '\
                    <p id="osio-provisioning-status" style="position: relative; top: 50%; margin-top: 60px; font-weight: 500; font-size: larger; color: #bbb;"></p>';
                pageLoaderDiv.appendChild(statusDiv);
                setStatusMessage = function(message) {
                    var messageToWrite;
                    lastOSIONotificationMessage = sessionStorage.getItem('osio-provisioning-notification-message');
                    if (lastOSIONotificationMessage) {
                        messageToWrite = lastOSIONotificationMessage;
                    } else {
                        messageToWrite = message;
                    }

                    document.getElementById("osio-provisioning-status").innerHTML = messageToWrite;
                }
            } else {
                setStatusMessage = function(message) {}
            }

            setStatusMessage("");

            const segmentWriteKeyUrl = '/api/fabric8-che-analytics/segment-write-key';
            get(segmentWriteKeyUrl)
            .then((request) => {
                var segmentKey = request.responseText;
                if (segmentKey != '') {
                    initAnalytics(segmentKey);
                }
                
                var promise = originalInit(initOptions);
                promise.success((arg) => {
                    var keycloak = kc;
                    identifyUserWithId(keycloak);
                    var lastProvisioningDate = sessionStorage.getItem('osio-provisioning');
                    var lastProvisioningTimeoutFailure = sessionStorage.getItem('osio-provisioning-timeout-failure');
                    sessionStorage.removeItem('osio-provisioning');
                    sessionStorage.removeItem('osio-provisioning-timeout-failure');
                    if (lastProvisioningDate) {
                        var w = window.open('', 'osio_provisioning');
                        w && w.close();
                    }
                    if (lastProvisioningDate || lastProvisioningTimeoutFailure) {
                        track(telemetry_event_provision_user_for_che);
                    }
                    performAccounkLinking(keycloak)
                    .then(()=>{
                        return setUpNamespaces(keycloak);
                    })
                    .then(() => {
                        identifyUser(keycloak)
                        .then(function() {
                            if (isInCheDashboard) {
                                track(telemetry_event_enter_che_dashboard);
                            }
                            setStatusMessage(osio_msg_started);
                            finalPromise.setSuccess(arg);
                        })
                    })
                    .catch((errorMessage) => {
                        post('/api/fabric8-che-analytics/error', errorMessage);
                        setStatusMessage(osio_msg_error_no_resources);
                        finalPromise.setError({ error: 'invalid_request', error_description: errorMessage });
                    });
                }).error((data) => {
                    sessionStorage.removeItem('osio-provisioning-timeout-failure');
                    var keycloak = kc;
                    if (data && data.error_description) {
                        osioUserToApprove = userNeedsApproval(data.error_description);
                    }

                    if (osioUserToApprove) {
                        var lastProvisioningDate = sessionStorage.getItem('osio-provisioning');
                        var isProvisioning = false;
                        var provisioningTimeoutFailure = false;
                        if (lastProvisioningDate) {
                            if (new Date().getTime() < parseInt(lastProvisioningDate) + provisioningTimeout) {
                                isProvisioning = true;
                            } else {
                                provisioningTimeoutFailure = true;
                            }
                        }

                        if (provisioningTimeoutFailure) {
                            post('/api/fabric8-che-analytics/error', 'Timeout while waiting for OSIO provisioning after opening the `manage.openshift.com` page for user: ' + osioUserToApprove);
                            sessionStorage.setItem('osio-provisioning-timeout-failure', 'true');
                            sessionStorage.removeItem('osio-provisioning');
                            sessionStorage.removeItem('osio-provisioning-notification-message')
                            setStatusMessage(osio_msg_error_no_resources);
                            finalPromise.setError({ error: 'invalid_request', error_description: 'Timeout while waiting for OSIO provisioning' });
                        } else {
                            if (!isProvisioning) {
                                get(provisioningPage)
                                .then((request) => {
                                    var contentType = request.getResponseHeader('content-type');
                                    if ( contentType && contentType.includes('html')) {
                                        var provisioningMessageDiv = document.createElement('div');
                                        provisioningMessageDiv.style = "height: 100%; z-index: 999; position:fixed; padding:0; margin:0; top:0; left:0; width: 100%; height: 100%; background:rgba(255,255,255,1);";
                                        provisioningMessageDiv.innerHTML = '<iframe id="osio-provisioning-frame" style="border: 0px; width: 100%; height: 100%"></iframe>';
                                        document.body.appendChild(provisioningMessageDiv);
                                        var htmlContent;
                                        if (osioUserToApprove != 'unknown') {
                                            htmlContent = request.responseText.replace('<span id="osio-user-placeholder"></span>', '<span id="osio-user-placeholder">, ' + osioUserToApprove + '</span>');
                                        } else {
                                            htmlContent = request.responseText;
                                        }
                                        var osioProvisioningFrameDocument = document.getElementById('osio-provisioning-frame').contentWindow.document
                                        osioProvisioningFrameDocument.open();
                                        osioProvisioningFrameDocument.write(htmlContent);
                                        osioProvisioningFrameDocument.close();
                                        track(telemetry_event_display_provisioning_page_for_che, { user: osioUserToApprove });
                                    } else {
                                        const errorMessage = 'OSIO provisioning page loaded at URL: ' + provisioningPage + ' should be valid HTML';
                                        post('/api/fabric8-che-analytics/error', errorMessage + ' for user ' + osioUserToApprove);
                                        sessionStorage.removeItem('osio-provisioning-notification-message');
                                        finalPromise.setError({ error: 'invalid_request', error_description: errorMessage });
                                    }
                                }, (request) => {
                                    const errorMessage = "OSIO provisioning page could not be loaded at URL: " + provisioningPage;
                                    post('/api/fabric8-che-analytics/error', errorMessage + ' for user ' + osioUserToApprove);
                                    sessionStorage.removeItem('osio-provisioning-notification-message');
                                    finalPromise.setError({ error: 'invalid_request', error_description: errorMessage });
                                });
                            } else {
                                setStatusMessage(osio_msg_provisioning);
                                sessionStorage.setItem('osio-provisioning-notification-message', osio_msg_provisioning);
                                setTimeout(() => {
                                    window.location.reload();
                                }, provisioningWaitDelay);
                            }
                        }
                    } else {
                        var errorMessage;
                        if (data && data.error_description) {
                            errorMessage = data.error_description;
                        } else {
                            errorMessage = "Login to RHD failed for an unknown reason";
                        }
                        post('/api/fabric8-che-analytics/error', errorMessage);
                        sessionStorage.removeItem('osio-provisioning');
                        sessionStorage.removeItem('osio-provisioning-notification-message');
                        setStatusMessage("Error during authentication");
                        finalPromise.setError(data);
                    }
                });
            })
            .catch((request) => {
                finalPromise.setError({ error: 'invalid_request', error_description: 'Che server API is unreachable at URL: ' + segmentWriteKeyUrl });
            })
            
            return finalPromise.promise;
        }
        return kc;
    }
})( window );
