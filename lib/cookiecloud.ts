import axios from 'axios';
import CryptoJS from 'crypto-js';

interface CookieData {
    domain: string;
    name: string;
    value: string;
    path: string;
    expirationDate?: number;
}



export async function getWereadCookieFromCloud(): Promise<string | null> {
    const host = process.env.COOKIECLOUD_HOST;
    const uuid = process.env.COOKIECLOUD_UUID;
    const password = process.env.COOKIECLOUD_PASSWORD;

    console.log(`[CookieCloud] Config check - Host: ${host ? 'Set' : 'Missing'}, UUID: ${uuid ? 'Set' : 'Missing'}`);

    if (!host || !uuid) {
        console.warn('[CookieCloud] Not configured. Skipping.');
        return null;
    }

    try {
        const url = `${host}/get/${uuid}`;
        console.log(`[CookieCloud] Fetching from: ${url}`);

        const response = await axios.get(url, {
            timeout: 10000,
            family: 4,
            proxy: false
        });
        const data = response.data;

        console.log(`[CookieCloud] API Response Status: ${response.status}`);

        if (typeof data !== 'object') {
            throw new Error(`Invalid response data type: ${typeof data}`);
        }

        console.log(`[CookieCloud] Raw keys: ${Object.keys(data).join(', ')}`);
        console.log(`[CookieCloud] Raw response data: ${JSON.stringify(data).substring(0, 200)}`);

        let cookieMap: { [key: string]: CookieData[] } = {};

        if (data.encrypted) {
            if (!password) {
                console.error('[CookieCloud] Data is encrypted but COOKIECLOUD_PASSWORD is missing in .env.local');
                return null;
            }

            try {
                // CookieCloud encrypts data using OpenSSL "Salted__" format
                // Official implementation: the_key = MD5(uuid+'-'+password).toString().substring(0,16)
                // Then decrypt with: CryptoJS.AES.decrypt(encrypted, the_key)

                console.log(`[CookieCloud] UUID length: ${uuid?.length}, Password length: ${password?.length}`);
                const the_key = CryptoJS.MD5(`${uuid}-${password}`).toString().substring(0, 16);
                console.log('[CookieCloud] Derived key (16 chars):', the_key);

                let encryptedData = data.encrypted;

                if (!encryptedData && data.cookie_data) {
                    encryptedData = data.cookie_data;
                }

                if (!encryptedData && data.data) {
                    encryptedData = data.data;
                }

                if (!encryptedData) {
                    throw new Error('Encrypted data field is missing. Keys found: ' + Object.keys(data).join(', '));
                }

                if (typeof encryptedData !== 'string') {
                    console.warn('[CookieCloud] Encrypted data is not a string, type:', typeof encryptedData);
                    encryptedData = JSON.stringify(encryptedData);
                }

                console.log('[CookieCloud] Attempting decryption with OpenSSL salted format...');
                console.log('[CookieCloud] Encrypted data prefix:', encryptedData.substring(0, 20));

                // Pass derivedPassword as STRING - CryptoJS will handle the OpenSSL salted format automatically
                // This uses PBKDF with the embedded salt (first 8 bytes after "Salted__") 
                const decrypted = CryptoJS.AES.decrypt(encryptedData, the_key);

                const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
                if (!decryptedString) {
                    throw new Error('Decryption resulted in empty string');
                }

                console.log('[CookieCloud] Raw Decrypted String (First 100 chars):', decryptedString.substring(0, 100));

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let decryptedMap: any = {};
                try {
                    if (decryptedString.startsWith('"')) {
                        const temp = JSON.parse(decryptedString);
                        if (typeof temp === 'string') {
                            decryptedMap = JSON.parse(temp);
                        } else {
                            decryptedMap = temp;
                        }
                    } else if (decryptedString.startsWith('{') || decryptedString.startsWith('[')) {
                        decryptedMap = JSON.parse(decryptedString);
                    } else {
                        console.error('[CookieCloud] Decrypted string is not JSON');
                        throw new Error('Invalid JSON');
                    }

                    if (decryptedMap && typeof decryptedMap === 'object' && !Array.isArray(decryptedMap)) {
                        if (decryptedMap.cookie_data) {
                            decryptedMap = decryptedMap.cookie_data;
                        }
                    }

                } catch (jsonErr) {
                    console.warn('[CookieCloud] JSON parse failed, raw decrypted:', decryptedString.substring(0, 50) + '...');
                    throw jsonErr;
                }

                cookieMap = decryptedMap;

                console.log('[CookieCloud] Successfully decrypted data.');
            } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                console.error(`[CookieCloud] Decryption failed: ${e.message}`);
                return null;
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieMap = (data as any).cookie_data;
        }

        if (!cookieMap) {
            console.warn('[CookieCloud] Response JSON valid but no "cookie_data" field found.');
            return null;
        }

        console.log(`[CookieCloud] Available domains in sync: ${Object.keys(cookieMap).join(', ')}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wereadCookies = (cookieMap as any)['weread.qq.com'] || (cookieMap as any)['.weread.qq.com'];

        if (!wereadCookies || !Array.isArray(wereadCookies)) {
            console.warn('[CookieCloud] WeRead domain not found in synced data. Did you add "weread.qq.com" to the extension whitelist?');
            return null;
        }

        const cookieString = wereadCookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');

        console.log(`[CookieCloud] Success! Loaded ${wereadCookies.length} cookies for WeRead.`);
        return cookieString;

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (error.response) {
            console.error(`[CookieCloud] Server responded with status: ${error.response.status}`);
            if ([502, 503, 504].includes(error.response.status)) {
                console.error('[CookieCloud] The CookieCloud server is unreachable or down. Please check your Docker container.');
            }
        } else {
            console.error(`[CookieCloud] Connection failed: ${error.message}`);
            if (error.code === 'ECONNREFUSED') {
                console.error('[CookieCloud] Cannot connect to server. Is Docker running? Is port 8088 open?');
            }
        }
        return null;
    }
}
