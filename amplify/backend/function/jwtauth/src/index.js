const crypto = require('crypto');
const config = require('./config');

const iss = `https://cognito-idp.${config.REGION}.amazonaws.com/${config.USERPOOLID}`;
const jwks = JSON.parse(config.JWKS);

// Convert JWKS to crypto.KeyObject instances
const keys = {};
jwks.keys.forEach(key => {
    if (key.kty === 'RSA') {
        try {
            // Create KeyObject directly from JWK
            const keyObject = crypto.createPublicKey({
                key: key,
                format: 'jwk'
            });
            keys[key.kid] = keyObject;
        } catch (err) {
            console.log('Failed to create key for kid:', key.kid, err.message);
        }
    }
});

const response401 = {
    status: '401',
    statusDescription: 'Unauthorized'
};

exports.handler = (event, context, callback) => {
    const cfrequest = event.Records[0].cf.request;
    const srcQuerystring = cfrequest.querystring;
    
    console.log('qurey pam=', 'token=' + (srcQuerystring.match(/token=([^&]*)/) || ['', 'none'])[1]);

    // Extract token from query string
    const tokenMatch = srcQuerystring.match(/token=([^&]*)/);
    if (!tokenMatch) {
        console.log('No token found in query string');
        callback(null, response401);
        return false;
    }

    const jwtToken = decodeURIComponent(tokenMatch[1]);
    console.log('jwtToken=' + jwtToken);

    // Decode JWT token
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
        console.log("Invalid JWT token format");
        callback(null, response401);
        return false;
    }

    const header = JSON.parse(base64urlDecode(parts[0]).toString());
    const payload = JSON.parse(base64urlDecode(parts[1]).toString());
    
    console.log('Decoded Token', { header, payload });

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

    // Get key for signature verification
    const kid = header.kid;
    const keyObject = keys[kid];
    if (!keyObject) {
        console.log('Invalid access token - no matching key');
        callback(null, response401);
        return false;
    }

    // Verify signature
    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(parts[0] + '.' + parts[1]);
        
        const signatureBuffer = base64urlDecode(parts[2]);
        const isValid = verifier.verify(keyObject, signatureBuffer);
        
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

        console.log('Successful verification');
        
        // Remove token from query string for S3 request
        cfrequest.querystring = srcQuerystring.replace(/[?&]?token=[^&]*&?/, '').replace(/^&/, '');
        
        callback(null, cfrequest);
        return true;

    } catch (err) {
        console.log('Token failed verification', err.message);
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
