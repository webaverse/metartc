#!/bin/bash

const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');

const port = 3000;

const app = express();
app.use(express.static(__dirname));
const server = http.createServer(app);
server.listen(port);