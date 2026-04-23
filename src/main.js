/*
 * @Author: Vincent Young
 * @Date: 2023-03-05 16:18:02
 * @LastEditors: Vincent Young
 * @LastEditTime: 2023-11-16 03:04:30
 * @FilePath: /bob-plugin-deeplx/src/main.js
 * @Telegram: https://t.me/missuo
 *
 * Copyright © 2023 by Vincent, All Rights Reserved.
 */
var lang = require("./lang.js");

function supportLanguages() {
    return lang.supportedLanguages.map(([standardLang]) => standardLang);
}

function pickRequestUrl(rawUrl, accessToken) {
    const trimmed = (rawUrl || "").trim();
    const token = (accessToken || "").trim();

    if (!trimmed) {
        return { url: "", useHeaderAuth: false };
    }

    const tokenPlaceholderPattern = /{\s*(token|api[_-]?key|key|api\s*key)\s*}/gi;
    if (token && tokenPlaceholderPattern.test(trimmed)) {
        return { url: trimmed.replace(tokenPlaceholderPattern, encodeURIComponent(token)), useHeaderAuth: false };
    }

    const normalized = trimmed.replace(/\/+$/, "");
    const isDeeplxCloud = /^https?:\/\/api\.deeplx\.org(?:\/|$)/i.test(normalized);
    const hasPathToken = /\/[^/]+\/translate$/i.test(normalized);

    if (isDeeplxCloud) {
        if (hasPathToken) {
            return { url: normalized, useHeaderAuth: false };
        }

        if (token) {
            if (/\/translate$/i.test(normalized)) {
                return {
                    url: normalized.replace(/\/translate$/i, `/${encodeURIComponent(token)}/translate`),
                    useHeaderAuth: false,
                };
            }
            return {
                url: `${normalized}/${encodeURIComponent(token)}/translate`,
                useHeaderAuth: false,
            };
        }

        if (!/\/translate$/i.test(normalized)) {
            return { url: `${normalized}/translate`, useHeaderAuth: false };
        }
        return { url: normalized, useHeaderAuth: false };
    }

    return { url: normalized, useHeaderAuth: Boolean(token) };
}

function translate(query, completion) {
    let sourceLang = "";
    if (query.from === "auto") {
        sourceLang = lang.langMap.get(query.detectFrom);
    } else {
        sourceLang = lang.langMap.get(query.from);
    }
    let targetLang = "";
    if (query.to === "auto") {
        targetLang = lang.langMap.get(query.detectTo);
    } else {
        targetLang = lang.langMap.get(query.to);
    }

    const body = JSON.stringify({
        text: query.text,
        source_lang: sourceLang,
        target_lang: targetLang,
    });

    (async () => {
        const urlOptions = ($option.url || "").split(",").map((url) => url.trim()).filter(Boolean);
        if (urlOptions.length === 0) {
            completion({
                error: {
                    type: "invalidConfig",
                    message: "API URL not configured",
                },
            });
            return;
        }
        const randomUrlTemplate = urlOptions[Math.floor(Math.random() * urlOptions.length)];
        const accessToken = $option.token;
        const { url, useHeaderAuth } = pickRequestUrl(randomUrlTemplate, accessToken);
        if (!url) {
            completion({
                error: {
                    type: "invalidConfig",
                    message: "Invalid API URL",
                },
            });
            return;
        }
        const headers = {
            "Content-Type": "application/json",
        };
        if (useHeaderAuth && accessToken) {
            headers.Authorization = "Bearer " + accessToken;
        }
        const resp = await $http.request({
            method: "POST",
            url,
            header: headers,
            body: $data.fromUTF8(body)
        });
        const {
            statusCode
        } = resp.response;
        let alternativesString = "";
        if (statusCode === 200 && resp.data.data){
            if (resp.data.alternatives) {
                alternativesString = resp.data.alternatives.join('\n');
            }
        if ($option.alternatives == "1") {
            completion({
                result: {
                    from: query.detectFrom,
                    to: query.detectTo,
                    toParagraphs: resp.data.data.split('\n'),
                    toDict: {
                        "additions": [{
                            "name": "Alternatives",
                            "value": alternativesString
                        }]
                    }
                },
            });
        } else {
            completion({
                result: {
                    from: query.detectFrom,
                    to: query.detectTo,
                    toParagraphs: resp.data.data.split('\n')
                },
            });
        }
        }else if (statusCode === 406) {
            completion({
                error: {
                    type: "unsupportedLanguage",
                    message: "Unsupported target languages",
                },
            });
            return;
        } else if (statusCode === 429) {
            completion({
                error: {
                    type: "api",
                    message: "Too many requests",
                },
            });
            return;
        } else if (statusCode === 401){
            completion({
                error: {
                    type: "secretKey",
                    message: "Access denied",
                },
            });
            return;
        }
    })().catch(err => {
        completion({
            error: {
                type: err._type || "unknown",
                message: err._message || "Unknown error",
                addition: err._addition,
            },
        });
    });
}

exports.supportLanguages = supportLanguages;
exports.translate = translate;
