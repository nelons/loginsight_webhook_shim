// include the http module
var http = require('http');
var https = require('https');
var url = require('url');

var vro_server = "";
var vro_port = 8281;
var vro_username = "administrator@vsphere.local";
var vro_password = "";

// create a webserver
http.createServer(function (req, res) {
	//console.log('Requested URL is ' + req.url);

	var responseCode = 500;

	// Get Body	
	var request_body_array = new Array();
	req.on('data', function(chunk) {
		request_body_array.push(chunk);
	});
	
	req.on('end', function() {
		var request_body = "";
		if (request_body_array.length > 0) {
			request_body = request_body_array.join('');
		}

		responseCode = handle_request(req.url, request_body);
		res.writeHead(responseCode, {'Content-Type': 'text/plain'});
		res.end();
	});

}).listen(5001);

function handle_request(request_url, request_body) {
	var responseCode = 500;

	var url_pathname = url.parse(request_url).pathname;
	if (url_pathname[0] == '/') {
		url_pathname = url_pathname.substr(1);
	}

	var url_path_tokens = url_pathname.split("/");
	try {
		if (url_path_tokens[0] == 'endpoint') {
			if (url_path_tokens[1] == 'vro') {
				var workflow_id = url_path_tokens[2];
				call_vro(workflow_id, request_body);
				responseCode = 200;
			}
		}
	} catch (e) {
		console.log(e);
	}
	
	// Not sure if needed - parsing any URL arguments.
	//var url_tokens = url.parse(req.url);

	return responseCode;
}

function call_vro(workflow_id, request_body)
{
	var creds_base64 = new Buffer(vro_username + ":" + vro_password).toString('base64');
	//var messages_value = new Buffer(request_body).toString('base64');

	var request_body_json = JSON.parse(request_body);
	var messages_value = new Buffer(request_body_json.messages).toString('base64');

	var vro_execution_context = {
		parameters: [
			{
				name: 'messages',
				description: 'Base64 encoded JSON of LogInsight messages',
				scope: 'local',
				type: 'string',
				value: {
					string: {
						value: messages_value
					}
				}
			},
			{
				name: 'alertName',
				scope: 'local',
				type: 'string',
				value: {
					string: {
						value: request_body_json.AlertName
					}
				}
			},
			{
				name: 'hitCount',
				scope: 'local',
				type: 'number',
				value: {
					number: {
						value: request_body_json.HitCount
					}
				}
			}
		]
	};

	var workflow_request_body = JSON.stringify(vro_execution_context);

	var vro_auth_options = {
		host: vro_server,
		port: vro_port,
		path: '/vco/api/workflows/' + workflow_id + '/executions',
		method: 'POST',
		rejectUnauthorized: false,
		headers:  {
			'Accept': 'application/json',
			'Content-Type': 'application/json;v=5.1.1',
			'Content-Length': workflow_request_body.length,
			'Authorization': 'Basic ' + creds_base64
		}
	};

	var auth_data_array = new Array();
	var callback = function(response) {
		response.on('data', function(chunk) {
			auth_data_array.push(chunk);
		});

		response.on('error', function(chunk) {
			console.log("ERROR = " + err.message);
		});

		response.on('end', function() {
			var auth_data = auth_data_array.join('');

			if (response.statusCode == 202) {
				if (auth_data.length > 0) {				
					var res = JSON.parse(auth_data);
				}

				console.log("Workflow " + workflow_id + " successfully started");

			} else {
				console.log("Workflow execution response: " + response.statusCode);
			}
		});
	}

	const req = https.request(vro_auth_options, callback);
	req.write(workflow_request_body);
	req.end();
}

// log what that we started listening on localhost:5001
console.log('Server running on port 5001');