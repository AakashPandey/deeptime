const params = new URLSearchParams(window.location.search);
const url = params.get('url');
if (url) {
    try {
        const decoded = decodeURIComponent(url);
        document.getElementById('blockedUrl').textContent = decoded;
        document.getElementById('blockedTitle').textContent = `${decoded} can't be reached`;
    } catch (e) {
        document.getElementById('blockedUrl').textContent = url;
    }
}
