# 🎬 Maç İzle - Senkronize Video İzleme Platformu

Arkadaşlarınla birlikte senkronize şekilde maç ve video izleyebileceğiniz platform.

## 🚀 Özellikler

- ✅ Senkronize video oynatma (HLS/M3U8 desteği)
- ✅ Gerçek zamanlı chat
- ✅ Emoji tepkileri
- ✅ Sesli konuşma (PeerJS)
- ✅ Mobil uyumlu tasarım
- ✅ 7 kişiye kadar oda desteği

## 📦 Kurulum

```bash
npm install
npm start
```

## 🌐 Render Deployment

Bu proje Render'da otomatik olarak deploy edilir.

### Otomatik Deployment

1. **GitHub Repository'yi Render'a Bağla:**
   - Render Dashboard'a git
   - "New +" → "Web Service" seç
   - GitHub repository'ni bağla
   - Render otomatik olarak `render.yaml` dosyasını kullanır

2. **Her Push'ta Otomatik Deploy:**
   - `main` branch'e push yaptığınızda Render otomatik olarak deploy eder
   - Deploy durumunu Render dashboard'dan takip edebilirsiniz

### Manuel Deploy

Eğer otomatik deploy çalışmıyorsa:

1. Render Dashboard → Servisiniz → "Manual Deploy" → "Deploy latest commit"

### Environment Variables

Render'da gerekli environment variable'lar:
- `NODE_ENV`: `production` (otomatik ayarlanır)
- `PORT`: Render otomatik olarak ayarlar

## 🔧 Geliştirme

```bash
npm run dev
```

## 📝 Notlar

- Socket.io için WebSocket bağlantıları gereklidir
- HLS video stream'leri için CORS ayarları yapılmıştır
- PeerJS için STUN server'ları kullanılmaktadır

## 🐛 Sorun Giderme

### Deploy Sorunları

1. **Build Hatası:**
   - `package.json` dosyasını kontrol edin
   - Node.js versiyonu 18+ olmalı

2. **Socket.io Bağlantı Sorunu:**
   - Render'da WebSocket desteği aktif olmalı
   - CORS ayarlarını kontrol edin

3. **Video Yüklenmiyor:**
   - HLS stream URL'lerinin geçerli olduğundan emin olun
   - CORS ayarlarını kontrol edin

## 📄 Lisans

MIT

