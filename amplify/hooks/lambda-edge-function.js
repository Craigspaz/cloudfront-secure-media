const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Configuration will be injected here
var config = {};
config.REGION = 'us-west-2'
config.USERPOOLID = 'us-west-2_gygYdW1OC'
config.JWKS = '{"keys":[{"alg":"RS256","e":"AQAB","kid":"ZnHi7X8VISH3ICCq4mTHx8VJJs738pOV2l/m3ukyE3U=","kty":"RSA","n":"tA4fs6Lr892dLuYhd7ph2OdY9JnlkNWe5TzO7nUIFQiHvdfOBn8kGz2wiaDJGsq1z6-dPrgYIiwe0iTTVxsTmRh70eG7iWknQuEkMuIP1UOFvP7kOuWTehphRtRFSPMOpBbNDmTKGmdtPTDmNG-Vc-A60aAqOwGDOKncUOU_TozgHMZNQ5TMWwk8ssovDxGHcsPeaOYzTFJXhJs66QSU4AQjMiGLKztjoDgfonw3ZJ-SKcpwqjWE8PtiHhSQ2k5QlZfq5wf36lhvWi6rhrcEVldOp9dTPr5Lgj4If6JPR39smxM17TdthOXhMULjkcHu2lQUEXs9rcu1WjuuYQ3yZQ","use":"sig"},{"alg":"RS256","e":"AQAB","kid":"Guu4CU/cEL+eC8R2eHDbaJ9SAR8jETCYoxBKazpEZDY=","kty":"RSA","n":"w3vJENQX-U94EgoreiAveuW8fTXrEHrP6RlJ9yovZ-slLWtSukcKVUSRfHFsdBcdAI-Nvk-iRf07jZ2zdnjl-s4_BcCPZZuCntyLjGRA-Im_3Iz2KpHCMzUeJhyYmoNNeNbEr2AMi44HQn2KppaEhnlLNl_nwKbLRDr5omTJk1gWrv8M-wJfqDetvGJVL5w3aosT1SlrQgnFlwdHBXH8qkrGtGkIxOFjOpp0-zIBvbXvzCYmLv2cJ2bVe6NCojbx70reJ4SuEE0vkhw6UaJRZFuGipU1Huey0ThwwJuDh6qzoBIjTlDXasmU_GqsCYFYagHjDVuu_vof21WUF8-KSw","use":"sig"}]}'

const jwks = JSON.parse(config.JWKS);

exports.handler = (event, context, callback) => {
    console.log('getting started');
    
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    
    console.log('cfrequest=', request);
    
    // Get token from query string
    const querystring = request.querystring;
    console.log('qurey pam=', querystring);
    
    const tokenMatch = querystring.match(/token=([^&]*)/);
    if (!tokenMatch) {
        console.log('No token found in query string');
        return callback(null, {
            status: '403',
            statusDescription: 'Forbidden',
            body: 'Access denied: No token provided'
        });
    }
    
    const jwtToken = decodeURIComponent(tokenMatch[1]);
    console.log('jwtToken=' + jwtToken);
    
    try {
        // Decode token without verification first
        const decoded = jwt.decode(jwtToken, { complete: true });
        console.log('Decoded Token', decoded);
        
        if (!decoded || !decoded.header || !decoded.header.kid) {
            throw new Error('Invalid token structure');
        }
        
        // Find the key
        const key = jwks.keys.find(k => k.kid === decoded.header.kid);
        if (!key) {
            throw new Error('Key not found');
        }
        
        // Convert JWK to PEM
        const publicKey = jwkToPem(key);
        
        // Verify token
        const verified = jwt.verify(jwtToken, publicKey, {
            algorithms: ['RS256'],
            issuer: `https://cognito-idp.${config.REGION}.amazonaws.com/${config.USERPOOLID}`
        });
        
        console.log('Successful verification');
        
        // Remove token from query string for S3 request
        request.querystring = querystring.replace(/[?&]?token=[^&]*&?/, '').replace(/^&/, '');
        
        callback(null, request);
        
    } catch (error) {
        console.log('Token verification failed:', error.message);
        return callback(null, {
            status: '403',
            statusDescription: 'Forbidden',
            body: 'Access denied: Invalid token'
        });
    }
};

function jwkToPem(jwk) {
    const { n, e } = jwk;
    const modulus = Buffer.from(n, 'base64');
    const exponent = Buffer.from(e, 'base64');
    
    // Simple RSA public key construction
    const modulusLength = modulus.length;
    const exponentLength = exponent.length;
    
    let offset = 0;
    const buffer = Buffer.alloc(1000); // Generous buffer
    
    // ASN.1 structure for RSA public key
    buffer[offset++] = 0x30; // SEQUENCE
    
    const lengthPos = offset++;
    
    buffer[offset++] = 0x30; // SEQUENCE
    buffer[offset++] = 0x0d; // Length
    buffer[offset++] = 0x06; // OBJECT IDENTIFIER
    buffer[offset++] = 0x09; // Length
    buffer[offset++] = 0x2a;
    buffer[offset++] = 0x86;
    buffer[offset++] = 0x48;
    buffer[offset++] = 0x86;
    buffer[offset++] = 0xf7;
    buffer[offset++] = 0x0d;
    buffer[offset++] = 0x01;
    buffer[offset++] = 0x01;
    buffer[offset++] = 0x01;
    buffer[offset++] = 0x05; // NULL
    buffer[offset++] = 0x00; // Length
    
    buffer[offset++] = 0x03; // BIT STRING
    const bitStringLengthPos = offset++;
    buffer[offset++] = 0x00; // Unused bits
    
    buffer[offset++] = 0x30; // SEQUENCE
    const innerSeqLengthPos = offset++;
    
    // Modulus
    buffer[offset++] = 0x02; // INTEGER
    if (modulus[0] & 0x80) {
        buffer[offset++] = modulusLength + 1;
        buffer[offset++] = 0x00;
        modulus.copy(buffer, offset);
        offset += modulusLength;
    } else {
        buffer[offset++] = modulusLength;
        modulus.copy(buffer, offset);
        offset += modulusLength;
    }
    
    // Exponent
    buffer[offset++] = 0x02; // INTEGER
    buffer[offset++] = exponentLength;
    exponent.copy(buffer, offset);
    offset += exponentLength;
    
    // Set lengths
    buffer[innerSeqLengthPos] = offset - innerSeqLengthPos - 1;
    buffer[bitStringLengthPos] = offset - bitStringLengthPos - 1;
    buffer[lengthPos] = offset - lengthPos - 1;
    
    const der = buffer.slice(0, offset);
    const pem = '-----BEGIN PUBLIC KEY-----\n' +
                der.toString('base64').match(/.{1,64}/g).join('\n') +
                '\n-----END PUBLIC KEY-----';
    
    return pem;
}
