const { User } = require('./models');
const jwt = require('jsonwebtoken');
const http = require('http');

async function test() {
    const u = await User.findOne();
    const token = jwt.sign({ id: u.id, username: u.username }, process.env.JWT_SECRET || 'secret123');

    const req = http.request('http://localhost:5000/api/price-lists/4', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', data));
    });

    req.on('error', console.error);
    req.write(JSON.stringify({
        name: 'Lista Modificada',
        status: 'active',
        isDefault: true,
        details: []
    }));
    req.end();
}

test();
