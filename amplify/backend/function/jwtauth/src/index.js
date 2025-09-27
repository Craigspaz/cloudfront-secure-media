const crypto = require('crypto');

// Configuration will be injected here
var config = {};
config.REGION = 'us-west-2'
config.USERPOOLID = 'us-west-2_gygYdW1OC'
config.JWKS = '{"keys":[{"alg":"RS256","e":"AQAB","kid":"ZnHi7X8VISH3ICCq4mTHx8VJJs738pOV2l/m3ukyE3U=","kty":"RSA","n":"tA4fs6Lr892dLuYhd7ph2OdY9JnlkNWe5TzO7nUIFQiHvdfOBn8kGz2wiaDJGsq1z6-dPrgYIiwe0iTTVxsTmRh70eG7iWknQuEkMuIP1UOFvP7kOuWTehphRtRFSPMOpBbNDmTKGmdtPTDmNG-Vc-A60aAqOwGDOKncUOU_TozgHMZNQ5TMWwk8ssovDxGHcsPeaOYzTFJXhJs66QSU4AQjMiGLKztjoDgfonw3ZJ-SKcpwqjWE8PtiHhSQ2k5QlZfq5wf36lhvWi6rhrcEVldOp9dTPr5Lgj4If6JPR39smxM17TdthOXhMULjkcHu2lQUEXs9rcu1WjuuYQ3yZQ","use":"sig"},{"alg":"RS256","e":"AQAB","kid":"Guu4CU/cEL+eC8R2eHDbaJ9SAR8jETCYoxBKazpEZDY=","kty":"RSA","n":"w3vJENQX-U94EgoreiAveuW8fTXrEHrP6RlJ9yovZ-slLWtSukcKVUSRfHFsdBcdAI-Nvk-iRf07jZ2zdnjl-s4_BcCPZZuCntyLjGRA-Im_3Iz2KpHCMzUeJhyYmoNNeNbEr2AMi44HQn2KppaEhnlLNl_nwKbLRDr5omTJk1gWrv8M-wJfqDetvGJVL5w3aosT1SlrQgnFlwdHBXH8qkrGtGkIxOFjOpp0-zIBvbXvzCYmLv2cJ2bVe6NCojbx70reJ4SuEE0vkhw6UaJRZFuGipU1Huey0ThwwJuDh6qzoBIjTlDXasmU_GqsCYFYagHjDVuu_vof21WUF8-KSw","use":"sig"}]}'

const iss = `https://cognito-idp.${config.REGION}.amazonaws.com/${config.USERPOOLID}`;
const jwks = JSON.parse(config.JWKS);

// Convert JWKS to PEMs - using pre-computed correct PEMs
const pems = {
    'ZnHi7X8VISH3ICCq4mTHx8VJJs738pOV2l/m3ukyE3U=': `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtA4fs6Lr892dLuYhd7ph
2OdY9JnlkNWe5TzO7nUIFQiHvdfOBn8kGz2wiaDJGsq1z6+dPrgYIiwe0iTTVxsT
mRh70eG7iWknQuEkMuIP1UOFvP7kOuWTehphRtRFSPMOpBbNDmTKGmdtPTDmNG+V
c+A60aAqOwGDOKncUOU/TozgHMZNQ5TMWwk8ssovDxGHcsPeaOYzTFJXhJs66QSU
4AQjMiGLKztjoDgfonw3ZJ+SKcpwqjWE8PtiHhSQ2k5QlZfq5wf36lhvWi6rhrcE
VldOp9dTPr5Lgj4If6JPR39smxM17TdthOXhMULjkcHu2lQUEXs9rcu1WjuuYQ3y
ZQIDAQAB
-----END PUBLIC KEY-----`,
    'Guu4CU/cEL+eC8R2eHDbaJ9SAR8jETCYoxBKazpEZDY=': `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw3vJENQX+U94EgoreiAv
euW8fTXrEHrP6RlJ9yovZ+slLWtSukcKVUSRfHFsdBcdAI+Nvk+iRf07jZ2zdnjl
+s4/BcCPZZuCntyLjGRA+Im/3Iz2KpHCMzUeJhyYmoNNeNbEr2AMi44HQn2KppaE
hnlLNl/nwKbLRDr5omTJk1gWrv8M+wJfqDetvGJVL5w3aosT1SlrQgnFlwdHBXH8
qkrGtGkIxOFjOpp0+zIBvbXvzCYmLv2cJ2bVe6NCojbx70reJ4SuEE0vkhw6UaJR
ZFuGipU1Huey0ThwwJuDh6qzoBIjTlDXasmU/GqsCYFYagHjDVuu/vof21WUF8+K
SwIDAQAB
-----END PUBLIC KEY-----`
};

const response401 = {
    status: '401',
    statusDescription: 'Unauthorized'
};

exports.handler = (event, context, callback) => {
    const cfrequest = event.Records[0].cf.request;
    console.log('getting started');
    console.log('cfrequest=', cfrequest);
    
    const srcQuerystring = cfrequest.querystring;
    console.log('qurey pam=', srcQuerystring);

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
        console.log("Not a valid JWT token");
        callback(null, response401);
        return false;
    }

    const header = JSON.parse(base64urlDecode(parts[0]).toString());
    const payload = JSON.parse(base64urlDecode(parts[1]).toString());
    
    console.log("Decoded Token", { header, payload });

    // UserPool check
    if (payload.iss != iss) {
        console.log("invalid issuer");
        callback(null, response401);
        return false;
    }

    // Reject if it's not an 'Access Token'
    if (payload.token_use != 'access') {
        console.log("Not an access token");
        callback(null, response401);
        return false;
    }

    // Get the kid from the token and retrieve corresponding PEM
    const kid = header.kid;
    const pem = pems[kid];
    if (!pem) {
        console.log('Invalid access token - no matching key');
        callback(null, response401);
        return false;
    }

    // Verify the signature
    try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(parts[0] + '.' + parts[1]);
        
        // Decode base64url signature to buffer
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

        // Valid token
        console.log('Successful verification');
        
        // Remove token from query string for S3 request
        cfrequest.querystring = srcQuerystring.replace(/[?&]?token=[^&]*&?/, '').replace(/^&/, '');
        
        // CloudFront can proceed to fetch the content from origin
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
