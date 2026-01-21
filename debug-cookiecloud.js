const axios = require('axios');
const CryptoJS = require('crypto-js');

async function testCookieCloud() {
    const host = "http://127.0.0.1:8088";
    const uuid = "myCdHjJVDQug6tMnZv3xQR";
    const password = "4zHA4VFZzvTWHJSgNBDmLx";

    console.log(`Testing CookieCloud with Host: ${host}, UUID: ${uuid}`);

    try {
        const url = `${host}/get/${uuid}`;
        console.log(`Fetching from: ${url}`);
        const response = await axios.get(url, { timeout: 5000 });
        const data = response.data;

        console.log('Response received.');

        if (data.encrypted) {
            console.log('Data is encrypted.');
            const the_key = CryptoJS.MD5(`${uuid}-${password}`).toString().substring(0, 16);
            console.log('Derived key:', the_key);

            let encryptedData = data.encrypted;
            if (typeof encryptedData !== 'string') { // Handle case where it might be parsed already?
                encryptedData = JSON.stringify(encryptedData);
            }

            try {
                const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, the_key);
                const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

                if (!decryptedString) {
                    console.error('Decryption failed (empty result). Password might be wrong.');
                } else {
                    console.log('Decryption successful.');
                    console.log('Decrypted snippet:', decryptedString.substring(0, 100));

                    const json = JSON.parse(decryptedString);
                    const cookieData = json.cookie_data || json;

                    const domains = Object.keys(cookieData);
                    console.log('Domains found:', domains);

                    if (cookieData['weread.qq.com'] || cookieData['.weread.qq.com']) {
                        console.log('Found WeRead cookies!');
                    } else {
                        console.warn('WeRead cookies NOT found.');
                    }
                }
            } catch (e) {
                console.error('Decryption error:', e.message);
            }
        } else {
            console.log('Data is NOT encrypted.');
            const cookieData = data.cookie_data;
            if (cookieData) {
                if (cookieData['weread.qq.com'] || cookieData['.weread.qq.com']) {
                    console.log('Found WeRead cookies!');
                } else {
                    console.warn('WeRead cookies NOT found.');
                }
            }
        }

    } catch (e) {
        console.error('Request failed:', e.message);
        if (e.code === 'ECONNREFUSED') {
            console.error('Make sure CookieCloud is running locally on port 8088.');
        }
    }
}

testCookieCloud();
