//234567890123456789012345678901234567890123456789012345678901234567890123456789

/**
 * @fileOverview Library for accessing the <a href="http://www.vericlock.com/api/1.0/docs>VeriClock API</a>
 * @author <a href="mailto:andrew@roberts.net">Andrew Roberts</a>
 * @copyright <a href="http://www.crestwoodpainting.com">Crestwood Painting</a>
 */

// JSHint: 26 March 2015 09:44 GMT
/* jshint asi: true */

/*
 * Copyright (C) 2015 Crestwood Painting (http://crestwoodpainting.com/)
 * 
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later 
 * version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along with 
 * this program. If not, see http://www.gnu.org/licenses/.
 */

// Public Properties
// -----------------

// NOTE: https://api.vericlock.com/ also works
var API_URL = 'https://api.vericlock.com/api/' 
var API_VERSION = '1.0/'
var AUTH_PATH = 'auth'
var JOB_CREATE_PATH = 'job/create'
var GET_JOBS_PATH = 'job/query'
var GET_TIMESHEETS_PATH = 'timesheet/query'
var GET_EMPLOYEES_PATH = 'employee/query'

// Enum for whether a new auth token should be generated or not
var CreateNewAuthToken = Object.freeze({

  YES: true,
  NO: false  
})

// Private Properties
// ------------------

var PROPERTY_AUTH_TOKEN_ = 'Vericlock library - auth token'
var PROPERTY_PUBLIC_KEY_ = 'Vericlock library - public key'
var PROPERTY_PRIVATE_KEY_ = 'Vericlock library - private key'
var PROPERTY_VERICLOCK_DOMAIN_ = 'Vericlock library - vericlock domain'

var AUTH_URL_ = API_URL + API_VERSION + AUTH_PATH
var JOB_CREATE_URL_ = API_URL + API_VERSION + JOB_CREATE_PATH
var GET_JOBS_URL_ = API_URL + API_VERSION + GET_JOBS_PATH
var GET_TIMESHEETS_URL_ = API_URL + API_VERSION + GET_TIMESHEETS_PATH
var GET_EMPLOYEES_URL_ = API_URL + API_VERSION + GET_EMPLOYEES_PATH

// Public Methods
// --------------

/**
 * Connect to the VeriClock API and get an authorisation token. If one is already 
 * stored that is returned, although it may have expired in which case force the 
 * creation of a new one
 *
 * @param {CreateNewAuthToken} createNewAuthToken Enum for whether to use the stored auth token or not
 * @param {object} config VeriClock configuration settings, only need if creating a new connect and auth token, see https://www.vericlock.com/api/1.0/docs#model_Authentication
 *   @param {string} [publicKey] public key guid string xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   @param {string} [privateKey] private key guid string xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   @param {string} [vericlockDomain] <this value>.vericlock.com
 *   @param {string} [username] email address of user
 *   @param {string} [password] user's password
 *
 * @return {string} guid auth token string or null
 */

function connect(createNewAuthToken, config) {

  var properties = PropertiesService.getUserProperties()
  
  var authToken = properties.getProperty(PROPERTY_AUTH_TOKEN_)

  if (authToken !== null && !createNewAuthToken) {
  
    return authToken
  } 

  config = setDefault_(config, {})

  var publicKey = config.publicKey
  var privateKey = config.privateKey
  var vericlockDomain = config.vericlockDomain
  var username = config.username
  var password = config.password

  assertString_(publicKey, 'You must specify a public key')
  assertString_(privateKey, 'You must specify a private key')
  assertString_(vericlockDomain, 'You must specify a VeriClock domain')
  assertString_(username, 'You must specify a username')
  assertString_(password, 'You must specify a password')

  var payload = serialize_({

    "user": username,
    "password": password
  })

  var signature = generateSignature_(
    '/' + API_VERSION + AUTH_PATH, 
    payload, 
    privateKey
  )

  var options = {

    "headers": {
    
      "vericlock_api_public_key": publicKey, 
      "vericlock_domain": vericlockDomain, 
      "vericlock_signature": signature, 
      "Content-Type": 'application/json' 
    },
    
    "method": "post",
    "payload": payload,
    "muteHttpExceptions": false,
  }

  var response = UrlFetchApp.fetch(AUTH_URL_, options)

  // An error is thrown if the fetch fails, so assume success
  
  authToken = JSON.parse(response.getContentText()).authToken.token
  
  properties.setProperty(PROPERTY_AUTH_TOKEN_, authToken)
  properties.setProperty(PROPERTY_PUBLIC_KEY_, publicKey)
  properties.setProperty(PROPERTY_PRIVATE_KEY_, privateKey)
  properties.setProperty(PROPERTY_VERICLOCK_DOMAIN_, vericlockDomain)
  
  return authToken
  
} // connect()

/** 
 * Create a new vericlock job
 *
 * @param {object} config see https://www.vericlock.com/api/1.0/docs#route_Create_Job
 *   @param {string} [jobName]
 *   @param {string} [jobDescription] optional, defaults to ''
 *   @param {string} [jobCode] optional, assigned by VeriClock if not defined
 *   @param {string} [jobStatus] optional, defaults to 'active'
 *
 * @return {object} job info - see https://www.vericlock.com/api/1.0/docs#route_Create_Job for details
 */

function createJob(config) {

  var jobName = config.jobName

  assertString_(jobName, 'You must give the job a name')
  assertNotEmpty_(jobName, 'You must give the job a name')  
  
  var jobDescription = setDefault_(config.jobDescription, '')
  var jobCode = setDefault_(config.jobCode, '')
  var jobStatus = setDefault_(config.jobStatus, 'active')

  var payload = {
  
    name: jobName,
    description: jobDescription,
    status: jobStatus,
//    accessControl: "none",
//    parentGuid: null,
//    employeeAccessList: null
  }
  
  if (jobCode !== '') {
  
    payload.code = jobCode
  }
  
  var options = getOptions_(payload, JOB_CREATE_PATH)
  var response = UrlFetchApp.fetch(JOB_CREATE_URL_, options)
  
  // An error is thrown if the fetch fails, so assume success
  
  var jobInfo = JSON.parse(response.getContentText())

  return jobInfo

} // createJob()

/**
 * Get an array of jobs
 *
 * @param {object} config See https://www.vericlock.com/api/1.0/docs#route_Get_Jobs for details
 *
 * @return {[objects]} an array of job objects
 */
 
function getJobs(config) {
  
  // VeriClock will validate the config 
  
  var options = getOptions_(config, GET_JOBS_PATH)  
  var jsonResponse = UrlFetchApp.fetch(GET_JOBS_URL_, options)
  var jobsArray = JSON.parse(jsonResponse)
  return jobsArray
  
} // getJobs()

/**
 * Get an array of timesheet objects
 *
 * @param {object} config See https://www.vericlock.com/api/1.0/docs#route_Time_Sheet_Query for details 
 *
 * @return {[objects]} array of timesheet objects
 */

function getTimesheets(config) {
  
  // VeriClock will validate the config  
  
  var options = getOptions_(config, GET_TIMESHEETS_PATH)
  var jsonResponse = UrlFetchApp.fetch(GET_TIMESHEETS_URL_, options)
  var timesheetArray = JSON.parse(jsonResponse)  
  return timesheetArray
  
} // getTimesheets()

/**
 * Get an array of employee objects
 *
 * @param {object} config See https://www.vericlock.com/api/1.0/docs#route_Employee_Query for details 
 *
 * @return {[objects]} array of employee objects
 */

function getEmployees(config) {
  
  // VeriClock will validate the config
  
  var options = getOptions_(config, GET_EMPLOYEES_PATH)  
  var jsonResponse = UrlFetchApp.fetch(GET_EMPLOYEES_URL_, options)
  var employeesArray = JSON.parse(jsonResponse)
  return employeesArray
  
} // getEmployees()

/**
 * Disconnect from the VeriClock API. This doesn't invalidate the auth 
 * token which is left to automatically expire. It just clears the libraries
 * local storage.
 */
 
function disconnect() {

  var properties = PropertiesService.getUserProperties()
  
  properties.deleteProperty(PROPERTY_AUTH_TOKEN_)
  properties.deleteProperty(PROPERTY_PUBLIC_KEY_)
  properties.deleteProperty(PROPERTY_PRIVATE_KEY_)
  properties.deleteProperty(PROPERTY_VERICLOCK_DOMAIN_)
  
  // The auth token will invalidate automatically when not used
  
} // disconnect()

// Private Methods
// ---------------

/**
 * Construct the options for the UrlFetchApp.fetch()
 *
 * @param {object} payload
 * @param {string} path
 */

function getOptions_(payload, path) {

  var properties = PropertiesService.getUserProperties() 

  var authToken = properties.getProperty(PROPERTY_AUTH_TOKEN_)
  var publicKey = properties.getProperty(PROPERTY_PUBLIC_KEY_)
  var privateKey = properties.getProperty(PROPERTY_PRIVATE_KEY_)
  var vericlockDomain = properties.getProperty(PROPERTY_VERICLOCK_DOMAIN_)  

  assertString_(authToken, 'No auth token stored, call connect() first')
  assertString_(publicKey, 'No public key stored, call connect() first')
  assertString_(privateKey, 'No private key stored, call connect() first')
  assertString_(vericlockDomain, 'No VeriClock domain stored, call connect() first')  
  
  var serializedPayload = serialize_(payload)
  
  var signature = generateSignature_(
    '/' + API_VERSION + path, 
    serializedPayload, 
    privateKey)

  var options = {
  
    "headers": {
      "vericlock_api_public_key": publicKey, 
      "vericlock_domain": vericlockDomain, 
      "vericlock_authtoken": authToken,
      "vericlock_signature": signature,
      "Content-Type": 'application/json' 
    },
    
    "method" : "post",
    "payload" : serializedPayload,
    "muteHttpExceptions" : false,
  }

  return options
  
} // getOptions_()
    
/**
 * Generate a new signature
 *
 * @param {string} uri
 * @param {string} payload body
 * @param {string} private key guid string
 *
 * @return {string} hexit string
 */

function generateSignature_(uri, body, privateKeyGuidString) {

  var shaObj = new jsSHA(uri + body, "TEXT")
  var privateKeyNoDashes = privateKeyGuidString.replace(/-/g,'')
  var signature = shaObj.getHMAC(privateKeyNoDashes, "HEX", "SHA-256", "HEX")
  
  return signature
    
} // generateSignature_()

/**
 * Convert object into a query string. From:
 * https://gist.github.com/dgs700/4677933
 *
 * @param {object} object
 *
 * @return {string} query string
 */

function serialize_(a) {

  var prefix, s, add, name, r20, output;
  s = [];
  r20 = /%20/g;
  add = function (key, value) {
    // If value is a function, invoke it and return its value
    value = ( typeof value == 'function' ) ? value() : ( value == null ? "" : value );
    s[ s.length ] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
  };
  if (a instanceof Array) {
    for (name in a) {
      add(name, a[name]);
    }
  } else {
    for (prefix in a) {
      buildParams(prefix, a[ prefix ], add);
    }
  }
  output = s.join("&").replace(r20, "+");
  return output;
  
  // Private Functions
  // -----------------
  
  function buildParams(prefix, obj, add) {
    var name, i, l, rbracket;
    rbracket = /\[\]$/;
    if (obj instanceof Array) {
      for (i = 0, l = obj.length; i < l; i++) {
        if (rbracket.test(prefix)) {
          add(prefix, obj[i]);
        } else {
          buildParams(prefix + "[" + ( typeof obj[i] === "object" ? i : "" ) + "]", obj[i], add);
        }
      }
    } else if (typeof obj == "object") {
      // Serialize object item.
      for (name in obj) {
        buildParams(prefix + "[" + name + "]", obj[ name ], add);
      }
    } else {
      // Serialize scalar item.
      add(prefix, obj);
    }
    
  } // buildParams()
  
} // serialize_()

/**
 * Assert a value is a string
 *
 * @param {object} testValue The value to test
 * @param {string} errorMessage The error message to throw 
 */

function assertString_(testValue, errorMessage) {

  if (typeof testValue !== 'string') {
  
    throw new TypeError(errorMessage)
  }
  
} // assertString_()

/**
 * Assert a value is not empty
 *
 * @param {object} testValue The value to test
 * @param {string} errorMessage The error message to throw 
 */

function assertNotEmpty_(testValue, errorMessage) {

  if (testValue === '') {
  
    throw new TypeError(errorMessage)
  }
  
} // assertNotEmpty_()

/**
 * Set a default value
 *
 * @param {object} actualValue
 * @param {object} defaultValue
 *
 * @return {object} actual or default value
 */
 
function setDefault_(actualValue, defaultValue) {

  var result;
  
  if (typeof actualValue === 'undefined' || 
      typeof actualValue === null) {
      
    result = defaultValue
    
  } else {
    
    result = actualValue
  }
  
  return result
  
} // setDefault_()
