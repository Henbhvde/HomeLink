# ADR-001: OAuth2 / OIDC provider

## Decision

HomeLink эхний хувилбарт **Google OIDC** ашиглана. Урсгал нь backend дээрх Authorization Code exchange бөгөөд access/refresh token-ийг HomeLink өөрөө олгоно.

## Provider roadmap

- Одоо: Google OIDC — manager болон resident-ийн self-service login.
- Дараа: Microsoft Entra ID — байгууллагын хэрэглэгчдэд.
- Enterprise: tenant бүрийн OIDC discovery URL/client тохиргоогоор байгууллагын IdP.

## Rules

- External subject-ийн үндсэн түлхүүр: `(provider, subject)`; email дангаараа identity биш.
- Account linking зөвхөн баталгаажсан email болон нэвтэрсэн хэрэглэгчийн зөвшөөрлөөр хийгдэнэ.
- Disabled user/tenant бүх provider дээр хаагдана.
- `state`, `nonce`, PKCE S256, exact redirect URI, issuer/audience validation заавал байна.
- Provider token browser storage-д хадгалахгүй; HomeLink-ийн short-lived access + rotated HttpOnly refresh flow ашиглана.

## Why

Google одоогийн бүтээгдэхүүний код, хэрэглэгчийн урсгалтай нийцнэ. Provider-neutral `(provider, subject)` загвар нь Entra ID болон enterprise IdP-г auth contract өөрчлөхгүй нэмэх боломж өгнө.
