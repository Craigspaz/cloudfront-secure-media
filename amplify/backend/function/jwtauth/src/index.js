const crypto = require('crypto');
const config = require('./config');

const iss = `https://cognito-idp.${config.REGION}.amazonaws.com/${config.USERPOOLID}`;
const jwks = JSON.parse(config.JWKS);

// Convert JWKS to PEMs dynamically
const pems = {};
jwks.keys.forEach(key => {
    if (key.kty === 'RSA') {
        // Convert JWK to PEM format
        const keyBuffer = Buffer.concat([
            Buffer.from('3082010a0282010100', 'hex'),
            Buffer.from(key.n, 'base64url'),
            Buffer.from('0203', 'hex'),
            Buffer.from(key.e, 'base64url')
        ]);
        const pem = `-----BEGIN PUBLIC KEY-----\n${keyBuffer.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
        pems[key.kid] = pem;
    }
});

const response401 = {
    status: '401',
    statusDescription: 'Unauthorized'
};

exports.handler = (event, context, callback) => {
    const cfrequest = event.Records[0].cf.request;
    const srcQuerystring = cfrequest.querystring;

    // Extract token from query string
    const tokenMatch = srcQuerystring.match(/token=([^&]*)/);
    if (!tokenMatch) {
        console.log('No token found in query string');
        callback(null, response401);
        return false;
    }

    const jwtToken = decodeURIComponent(tokenMatch[1]);

    // Decode JWT token
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
        console.log("Invalid JWT token format");
        callback(null, response401);
        return false;
    }

    const header = JSON.parse(base64urlDecode(parts[0]).toString());
    const payload = JSON.parse(base64urlDecode(parts[1]).toString());

    // Validate issuer
    if (payload.iss !== iss) {
        console.log("Invalid issuer");
        callback(null, response401);
        return false;
    }

    // Validate token type
    if (payload.token_use !== 'access') {
        console.log("Not an access token");
        callback(null, response401);
        return false;
    }

    // Get PEM for signature verification
    const kid = header.kid;
    const pem = pems[kid];
    if (!pem) {
        console.log('Invalid access token - no matching key');
        callback(null, response401);
        return false;
    }

    // Verify signature
    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(parts[0] + '.' + parts[1]);
        
        const signatureBuffer = base64urlDecode(parts[2]);
        const isValid = verifier.verify(pem, signatureBuffer);
        
        if (!isValid) {
            console.log('Token signature verification failed');
            callback(null, response401);
            return false;
        }

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            console.log('Token expired');
            callback(null, response401);
            return false;
        }

        console.log('Token verification successful');
        
        // Remove token from query string for S3 request
        cfrequest.querystring = srcQuerystring.replace(/[?&]?token=[^&]*&?/, '').replace(/^&/, '');
        
        callback(null, cfrequest);
        return true;

    } catch (err) {
        console.log('Token verification failed:', err.message);
        callback(null, response401);
        return false;
    }
};

// Helper function to decode base64url
function base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    return Buffer.from(str, 'base64');
}
