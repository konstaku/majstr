# Translations — Phase 2 UI (pt / de / fr / tr)

Date: 2026-05-18

Scope: First-pass professional UI translations for the Majstr onboarding wizard
(`frontend/src/onboarding/i18n.tsx`, `EN` dict) and the Telegram bot
(`backend/i18n.js`, `en` dict) into **European Portuguese (pt)**, **German (de)**,
**French (fr)** and **Turkish (tr)**.

Do NOT touch en/uk/ru/it. All `{fields}` / `{status}` / `{n}` / `{url}` /
`{label}` / `{labels}` / `{avail}` / `{langs}` placeholders and all emojis are
preserved verbatim. Tone: warm, trustworthy, plain, peer-to-peer craftsman
community — not corporate, not playful.

---

## Portuguese (pt) — European Portuguese

### Wizard strings

| Key | pt |
|---|---|
| step.profile | Perfil |
| step.profession | Profissão |
| step.location | Localização |
| step.bio | Sobre si |
| step.contact | Contactos |
| nav.next | Seguinte |
| nav.submit | Enviar |
| nav.back | Voltar |
| success.title | Obrigado! |
| success.text | O seu cartão foi enviado para análise. Avisamos no Telegram assim que for aprovado. |
| submit.failTitle | Não foi possível enviar |
| submit.failOk | Entendido |
| submit.errExists | Já tem um cartão de profissional ativo. |
| submit.errOffline | Sem ligação. Os seus dados estão guardados — tente enviar novamente. |
| submit.errValidation | Verifique estes campos: {fields} |
| submit.errGeneric | Não foi possível enviar. Tente novamente. |
| common.required | Obrigatório |
| common.optional | Opcional. |
| err.min2 | Pelo menos 2 caracteres |
| err.max25 | No máximo 25 caracteres |
| err.min30 | Pelo menos 30 caracteres |
| err.max600 | No máximo 600 caracteres |
| profile.usePhoto | Usar a minha foto do Telegram |
| profile.uploading | A carregar… |
| profile.uploadDevice | Carregar do dispositivo |
| profile.removePhoto | Remover foto |
| profile.uploadError | Falha ao carregar. Verifique a ligação e tente novamente. |
| profile.fileTooLarge | Ficheiro demasiado grande (máx. 5 MB). |
| profile.nameLabel | O seu nome |
| profile.namePlaceholder | Como se chama? |
| profile.nameHint | Os clientes verão isto no seu cartão. |
| prof.categoryLabel | Categoria |
| prof.chooseCategory | Escolha uma categoria |
| prof.professionLabel | Profissão |
| prof.chooseProfession | Escolha uma profissão |
| prof.chooseCategoryFirst | Escolha primeiro uma categoria |
| prof.langLabel | Línguas que fala |
| prof.langHint | Escolha pelo menos uma língua. |
| prof.maxLangs | Máximo 5 línguas. |
| prof.langRequired | Escolha pelo menos uma língua |
| loc.cityLabel | Cidade principal mais próxima |
| loc.chooseCity | Escolha uma cidade |
| loc.cityHint | Esta cidade aparece no seu cartão. Não significa que não trabalha noutras. |
| loc.countryLabel | País |
| loc.italy | 🇮🇹 Itália |
| loc.countryHint | Por agora, a Majstr funciona apenas em Itália. |
| bio.servicesLabel | Serviços (1 a 3) |
| bio.serviceRequired | Adicione pelo menos um serviço |
| bio.aboutLabel | Sobre si |
| bio.aboutPlaceholder | O que faz, em que zona, como o podem contactar melhor, com que rapidez responde. |
| bio.aboutHint | De 30 a 600 caracteres. |
| contact.hint | Como podem os clientes contactá-lo? |
| contact.shareNumber | Partilhar o meu número via Telegram |
| contact.shareManual | Introduza o número manualmente abaixo. |
| contact.shareDenied | Acesso negado. Introduza o número manualmente abaixo. |
| contact.shareFailed | Não foi possível obter o número automaticamente. Introduza-o manualmente abaixo. |
| contact.phoneLabel | Telefone |
| contact.phonePlaceholder | +39 333 123 45 67 |
| contact.phoneHint | Os clientes vão ligar para este número. |
| contact.telegramLabel | Telegram |
| contact.instagramLabel | Instagram |
| picker.search | Pesquisar |
| picker.empty | Nada encontrado. |
| picker.close | Fechar |
| tag.add | + Adicionar um serviço |
| tag.addConfirm | Adicionar |
| tag.namePlaceholder | Nome do serviço |
| tag.noHash | Sem # no início |
| tag.minChars | Pelo menos {n} caracteres |
| tag.maxChars | No máximo {n} caracteres |
| tag.dup | Esse serviço já foi adicionado |
| tag.atMax | Até 3 serviços. |
| tag.example | Ex.: “Mudança de óleo”, “Assistência BMW”, “Inspeção”. |
| tag.suggested | Sugeridos: |
| draft.errExists | Já tem um cartão de profissional ativo — não pode criar outro. |
| draft.errSession | Sessão não verificada. Feche e reabra a Mini App. |
| draft.errValidation | Não guardado — erro de validação ({fields}). |
| draft.errCode | Não foi possível guardar (erro {status}). |
| draft.errOffline | Sem ligação. Guardado localmente — tentamos novamente mais tarde. |

### Bot strings

| Key | pt |
|---|---|
| welcome.body | Bem-vindo à Majstr! 🛠\n\nEncontre um profissional ou registe-se como um.\n\n👇 Escolha o idioma / Choose language / Scegli la lingua |
| btn.addMaster | ➕ Adicionar o meu cartão |
| btn.loginSite | 🌐 Abrir o site |
| lang.switched | ✅ Idioma alterado |
| unknownCommand | Comando desconhecido. Disponíveis:\n/start — começar\n/available — disponível agora\n/nextweek — a partir da próxima semana\n/busy — ocupado\n/status — ver estado\n/languages — línguas faladas |
| avail.none | Nenhum cartão de profissional aprovado encontrado. |
| avail.updated | Estado atualizado: {label} |
| avail.available | 🟢 Disponível agora |
| avail.next_week | 🟡 A partir da próxima semana |
| avail.busy | 🔴 Ocupado |
| status.line | 📋 O seu perfil:\nEstado: {avail}\nLínguas: {langs}\n\nComandos:\n/available /nextweek /busy /languages |
| status.notset | não definido |
| langs.prompt | Escolha as línguas que fala (pode escolher várias): |
| langs.save | 💾 Guardar |
| langs.saved | Línguas guardadas: {labels} |
| owner.approved | ✅ O seu cartão foi aprovado e publicado!\n\nVer: {url} |
| owner.declined | ❌ Infelizmente o seu cartão não foi aprovado. Pode editar os dados e enviá-lo de novo através do bot. |

---

## German (de)

### Wizard strings

| Key | de |
|---|---|
| step.profile | Profil |
| step.profession | Beruf |
| step.location | Standort |
| step.bio | Über dich |
| step.contact | Kontakt |
| nav.next | Weiter |
| nav.submit | Absenden |
| nav.back | Zurück |
| success.title | Danke! |
| success.text | Deine Profilkarte wurde zur Prüfung eingereicht. Wir benachrichtigen dich auf Telegram, sobald sie freigegeben ist. |
| submit.failTitle | Senden nicht möglich |
| submit.failOk | Verstanden |
| submit.errExists | Du hast bereits eine aktive Profilkarte. |
| submit.errOffline | Keine Verbindung. Deine Daten sind gespeichert — versuche es erneut zu senden. |
| submit.errValidation | Prüfe diese Felder: {fields} |
| submit.errGeneric | Senden hat nicht geklappt. Bitte versuche es noch mal. |
| common.required | Pflichtfeld |
| common.optional | Optional. |
| err.min2 | Mindestens 2 Zeichen |
| err.max25 | Höchstens 25 Zeichen |
| err.min30 | Mindestens 30 Zeichen |
| err.max600 | Höchstens 600 Zeichen |
| profile.usePhoto | Mein Telegram-Foto verwenden |
| profile.uploading | Wird hochgeladen… |
| profile.uploadDevice | Vom Gerät hochladen |
| profile.removePhoto | Foto entfernen |
| profile.uploadError | Hochladen fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut. |
| profile.fileTooLarge | Datei zu groß (max. 5 MB). |
| profile.nameLabel | Dein Name |
| profile.namePlaceholder | Wie heißt du? |
| profile.nameHint | Kunden sehen das auf deiner Profilkarte. |
| prof.categoryLabel | Kategorie |
| prof.chooseCategory | Kategorie wählen |
| prof.professionLabel | Beruf |
| prof.chooseProfession | Beruf wählen |
| prof.chooseCategoryFirst | Wähle zuerst eine Kategorie |
| prof.langLabel | Sprachen, die du sprichst |
| prof.langHint | Wähle mindestens eine Sprache. |
| prof.maxLangs | Maximal 5 Sprachen. |
| prof.langRequired | Wähle mindestens eine Sprache |
| loc.cityLabel | Nächste größere Stadt |
| loc.chooseCity | Stadt wählen |
| loc.cityHint | Diese Stadt erscheint auf deiner Profilkarte. Das heißt nicht, dass du nicht auch anderswo arbeitest. |
| loc.countryLabel | Land |
| loc.italy | 🇮🇹 Italien |
| loc.countryHint | Vorerst ist Majstr nur in Italien verfügbar. |
| bio.servicesLabel | Leistungen (1 bis 3) |
| bio.serviceRequired | Füge mindestens eine Leistung hinzu |
| bio.aboutLabel | Über dich |
| bio.aboutPlaceholder | Was du machst, in welchem Gebiet, wie man dich am besten erreicht, wie schnell du antwortest. |
| bio.aboutHint | Zwischen 30 und 600 Zeichen. |
| contact.hint | Wie können Kunden dich erreichen? |
| contact.shareNumber | Meine Nummer über Telegram teilen |
| contact.shareManual | Gib deine Nummer unten manuell ein. |
| contact.shareDenied | Zugriff verweigert. Gib deine Nummer unten manuell ein. |
| contact.shareFailed | Nummer konnte nicht automatisch ermittelt werden. Gib sie unten manuell ein. |
| contact.phoneLabel | Telefon |
| contact.phonePlaceholder | +39 333 123 45 67 |
| contact.phoneHint | Kunden rufen diese Nummer an. |
| contact.telegramLabel | Telegram |
| contact.instagramLabel | Instagram |
| picker.search | Suchen |
| picker.empty | Nichts gefunden. |
| picker.close | Schließen |
| tag.add | + Leistung hinzufügen |
| tag.addConfirm | Hinzufügen |
| tag.namePlaceholder | Name der Leistung |
| tag.noHash | Kein # am Anfang |
| tag.minChars | Mindestens {n} Zeichen |
| tag.maxChars | Höchstens {n} Zeichen |
| tag.dup | Diese Leistung wurde bereits hinzugefügt |
| tag.atMax | Bis zu 3 Leistungen. |
| tag.example | Z. B. „Ölwechsel“, „BMW-Service“, „Hauptuntersuchung“. |
| tag.suggested | Vorschläge: |
| draft.errExists | Du hast bereits eine aktive Profilkarte — du kannst keine weitere erstellen. |
| draft.errSession | Sitzung nicht bestätigt. Schließe die Mini App und öffne sie erneut. |
| draft.errValidation | Nicht gespeichert — Validierungsfehler ({fields}). |
| draft.errCode | Speichern fehlgeschlagen (Fehler {status}). |
| draft.errOffline | Keine Verbindung. Lokal gespeichert — wir versuchen es später erneut. |

### Bot strings

| Key | de |
|---|---|
| welcome.body | Willkommen bei Majstr! 🛠\n\nFinde eine Fachkraft oder registriere dich selbst als eine.\n\n👇 Sprache wählen / Choose language / Scegli la lingua |
| btn.addMaster | ➕ Meine Profilkarte hinzufügen |
| btn.loginSite | 🌐 Website öffnen |
| lang.switched | ✅ Sprache geändert |
| unknownCommand | Unbekannter Befehl. Verfügbar:\n/start — starten\n/available — jetzt verfügbar\n/nextweek — ab nächster Woche\n/busy — ausgelastet\n/status — Status ansehen\n/languages — gesprochene Sprachen |
| avail.none | Keine freigegebene Profilkarte gefunden. |
| avail.updated | Status aktualisiert: {label} |
| avail.available | 🟢 Jetzt verfügbar |
| avail.next_week | 🟡 Ab nächster Woche |
| avail.busy | 🔴 Ausgelastet |
| status.line | 📋 Dein Profil:\nStatus: {avail}\nSprachen: {langs}\n\nBefehle:\n/available /nextweek /busy /languages |
| status.notset | nicht festgelegt |
| langs.prompt | Wähle die Sprachen, die du sprichst (mehrere möglich): |
| langs.save | 💾 Speichern |
| langs.saved | Sprachen gespeichert: {labels} |
| owner.approved | ✅ Deine Profilkarte wurde freigegeben und veröffentlicht!\n\nAnsehen: {url} |
| owner.declined | ❌ Leider wurde deine Profilkarte nicht freigegeben. Du kannst die Angaben bearbeiten und sie über den Bot erneut einreichen. |

---

## French (fr)

### Wizard strings

| Key | fr |
|---|---|
| step.profile | Profil |
| step.profession | Métier |
| step.location | Lieu |
| step.bio | À propos de vous |
| step.contact | Contacts |
| nav.next | Suivant |
| nav.submit | Envoyer |
| nav.back | Retour |
| success.title | Merci ! |
| success.text | Votre fiche a été envoyée pour validation. Nous vous préviendrons sur Telegram dès qu'elle sera approuvée. |
| submit.failTitle | Envoi impossible |
| submit.failOk | Compris |
| submit.errExists | Vous avez déjà une fiche professionnelle active. |
| submit.errOffline | Pas de connexion. Vos données sont enregistrées — réessayez d'envoyer. |
| submit.errValidation | Vérifiez ces champs : {fields} |
| submit.errGeneric | Envoi impossible. Veuillez réessayer. |
| common.required | Obligatoire |
| common.optional | Facultatif. |
| err.min2 | Au moins 2 caractères |
| err.max25 | 25 caractères maximum |
| err.min30 | Au moins 30 caractères |
| err.max600 | 600 caractères maximum |
| profile.usePhoto | Utiliser ma photo Telegram |
| profile.uploading | Envoi en cours… |
| profile.uploadDevice | Importer depuis l'appareil |
| profile.removePhoto | Retirer la photo |
| profile.uploadError | Échec de l'envoi. Vérifiez votre connexion et réessayez. |
| profile.fileTooLarge | Fichier trop volumineux (max. 5 Mo). |
| profile.nameLabel | Votre nom |
| profile.namePlaceholder | Comment vous appelez-vous ? |
| profile.nameHint | Les clients le verront sur votre fiche. |
| prof.categoryLabel | Catégorie |
| prof.chooseCategory | Choisissez une catégorie |
| prof.professionLabel | Métier |
| prof.chooseProfession | Choisissez un métier |
| prof.chooseCategoryFirst | Choisissez d'abord une catégorie |
| prof.langLabel | Langues que vous parlez |
| prof.langHint | Choisissez au moins une langue. |
| prof.maxLangs | 5 langues maximum. |
| prof.langRequired | Choisissez au moins une langue |
| loc.cityLabel | Grande ville la plus proche |
| loc.chooseCity | Choisissez une ville |
| loc.cityHint | Cette ville figurera sur votre fiche. Cela ne veut pas dire que vous ne travaillez pas ailleurs. |
| loc.countryLabel | Pays |
| loc.italy | 🇮🇹 Italie |
| loc.countryHint | Pour l'instant, Majstr fonctionne uniquement en Italie. |
| bio.servicesLabel | Services (de 1 à 3) |
| bio.serviceRequired | Ajoutez au moins un service |
| bio.aboutLabel | À propos de vous |
| bio.aboutPlaceholder | Ce que vous faites, dans quelle zone, comment vous joindre au mieux, à quelle vitesse vous répondez. |
| bio.aboutHint | De 30 à 600 caractères. |
| contact.hint | Comment les clients peuvent-ils vous joindre ? |
| contact.shareNumber | Partager mon numéro via Telegram |
| contact.shareManual | Saisissez votre numéro manuellement ci-dessous. |
| contact.shareDenied | Accès refusé. Saisissez votre numéro manuellement ci-dessous. |
| contact.shareFailed | Impossible d'obtenir le numéro automatiquement. Saisissez-le manuellement ci-dessous. |
| contact.phoneLabel | Téléphone |
| contact.phonePlaceholder | +39 333 123 45 67 |
| contact.phoneHint | Les clients appelleront ce numéro. |
| contact.telegramLabel | Telegram |
| contact.instagramLabel | Instagram |
| picker.search | Rechercher |
| picker.empty | Aucun résultat. |
| picker.close | Fermer |
| tag.add | + Ajouter un service |
| tag.addConfirm | Ajouter |
| tag.namePlaceholder | Nom du service |
| tag.noHash | Pas de # au début |
| tag.minChars | Au moins {n} caractères |
| tag.maxChars | {n} caractères maximum |
| tag.dup | Ce service est déjà ajouté |
| tag.atMax | Jusqu'à 3 services. |
| tag.example | Ex. : « Vidange », « Entretien BMW », « Contrôle technique ». |
| tag.suggested | Suggestions : |
| draft.errExists | Vous avez déjà une fiche professionnelle active — vous ne pouvez pas en créer une autre. |
| draft.errSession | Session non vérifiée. Fermez et rouvrez la Mini App. |
| draft.errValidation | Non enregistré — erreur de validation ({fields}). |
| draft.errCode | Enregistrement impossible (erreur {status}). |
| draft.errOffline | Pas de connexion. Enregistré en local — nous réessaierons plus tard. |

### Bot strings

| Key | fr |
|---|---|
| welcome.body | Bienvenue sur Majstr ! 🛠\n\nTrouvez un artisan ou inscrivez-vous comme professionnel.\n\n👇 Choisissez la langue / Choose language / Scegli la lingua |
| btn.addMaster | ➕ Ajouter ma fiche |
| btn.loginSite | 🌐 Ouvrir le site |
| lang.switched | ✅ Langue modifiée |
| unknownCommand | Commande inconnue. Disponibles :\n/start — démarrer\n/available — disponible maintenant\n/nextweek — à partir de la semaine prochaine\n/busy — occupé\n/status — voir le statut\n/languages — langues parlées |
| avail.none | Aucune fiche professionnelle approuvée trouvée. |
| avail.updated | Statut mis à jour : {label} |
| avail.available | 🟢 Disponible maintenant |
| avail.next_week | 🟡 À partir de la semaine prochaine |
| avail.busy | 🔴 Occupé |
| status.line | 📋 Votre profil :\nStatut : {avail}\nLangues : {langs}\n\nCommandes :\n/available /nextweek /busy /languages |
| status.notset | non défini |
| langs.prompt | Choisissez les langues que vous parlez (plusieurs possibles) : |
| langs.save | 💾 Enregistrer |
| langs.saved | Langues enregistrées : {labels} |
| owner.approved | ✅ Votre fiche a été approuvée et publiée !\n\nLa voir : {url} |
| owner.declined | ❌ Malheureusement, votre fiche n'a pas été approuvée. Vous pouvez modifier les informations et la renvoyer via le bot. |

---

## Turkish (tr)

### Wizard strings

| Key | tr |
|---|---|
| step.profile | Profil |
| step.profession | Meslek |
| step.location | Konum |
| step.bio | Hakkınızda |
| step.contact | İletişim |
| nav.next | İleri |
| nav.submit | Gönder |
| nav.back | Geri |
| success.title | Teşekkürler! |
| success.text | Profil kartınız incelenmek üzere gönderildi. Onaylandığında Telegram'dan size haber vereceğiz. |
| submit.failTitle | Gönderilemedi |
| submit.failOk | Anladım |
| submit.errExists | Zaten etkin bir profil kartınız var. |
| submit.errOffline | Bağlantı yok. Verileriniz kaydedildi — tekrar göndermeyi deneyin. |
| submit.errValidation | Şu alanları kontrol edin: {fields} |
| submit.errGeneric | Gönderilemedi. Lütfen tekrar deneyin. |
| common.required | Zorunlu |
| common.optional | İsteğe bağlı. |
| err.min2 | En az 2 karakter |
| err.max25 | En fazla 25 karakter |
| err.min30 | En az 30 karakter |
| err.max600 | En fazla 600 karakter |
| profile.usePhoto | Telegram fotoğrafımı kullan |
| profile.uploading | Yükleniyor… |
| profile.uploadDevice | Cihazdan yükle |
| profile.removePhoto | Fotoğrafı kaldır |
| profile.uploadError | Yükleme başarısız. Bağlantınızı kontrol edip tekrar deneyin. |
| profile.fileTooLarge | Dosya çok büyük (en fazla 5 MB). |
| profile.nameLabel | Adınız |
| profile.namePlaceholder | Adınız nedir? |
| profile.nameHint | Müşteriler bunu profil kartınızda görecek. |
| prof.categoryLabel | Kategori |
| prof.chooseCategory | Bir kategori seçin |
| prof.professionLabel | Meslek |
| prof.chooseProfession | Bir meslek seçin |
| prof.chooseCategoryFirst | Önce bir kategori seçin |
| prof.langLabel | Konuştuğunuz diller |
| prof.langHint | En az bir dil seçin. |
| prof.maxLangs | En fazla 5 dil. |
| prof.langRequired | En az bir dil seçin |
| loc.cityLabel | En yakın büyük şehir |
| loc.chooseCity | Bir şehir seçin |
| loc.cityHint | Bu şehir profil kartınızda yer alır. Başka şehirlerde çalışmadığınız anlamına gelmez. |
| loc.countryLabel | Ülke |
| loc.italy | 🇮🇹 İtalya |
| loc.countryHint | Şimdilik Majstr yalnızca İtalya'da çalışıyor. |
| bio.servicesLabel | Hizmetler (1 ile 3 arası) |
| bio.serviceRequired | En az bir hizmet ekleyin |
| bio.aboutLabel | Hakkınızda |
| bio.aboutPlaceholder | Ne yaptığınız, hangi bölgede, size en iyi nasıl ulaşılacağı, ne kadar hızlı yanıt verdiğiniz. |
| bio.aboutHint | 30 ile 600 karakter arası. |
| contact.hint | Müşteriler size nasıl ulaşabilir? |
| contact.shareNumber | Numaramı Telegram ile paylaş |
| contact.shareManual | Numaranızı aşağıya elle girin. |
| contact.shareDenied | Erişim reddedildi. Numaranızı aşağıya elle girin. |
| contact.shareFailed | Numara otomatik olarak alınamadı. Aşağıya elle girin. |
| contact.phoneLabel | Telefon |
| contact.phonePlaceholder | +39 333 123 45 67 |
| contact.phoneHint | Müşteriler bu numarayı arayacak. |
| contact.telegramLabel | Telegram |
| contact.instagramLabel | Instagram |
| picker.search | Ara |
| picker.empty | Sonuç bulunamadı. |
| picker.close | Kapat |
| tag.add | + Hizmet ekle |
| tag.addConfirm | Ekle |
| tag.namePlaceholder | Hizmet adı |
| tag.noHash | Başında # olmadan |
| tag.minChars | En az {n} karakter |
| tag.maxChars | En fazla {n} karakter |
| tag.dup | Bu hizmet zaten eklenmiş |
| tag.atMax | En fazla 3 hizmet. |
| tag.example | Örn. “Yağ değişimi”, “BMW servisi”, “Muayene”. |
| tag.suggested | Öneriler: |
| draft.errExists | Zaten etkin bir profil kartınız var — yenisini oluşturamazsınız. |
| draft.errSession | Oturum doğrulanmadı. Mini Uygulamayı kapatıp yeniden açın. |
| draft.errValidation | Kaydedilmedi — doğrulama hatası ({fields}). |
| draft.errCode | Kaydedilemedi (hata {status}). |
| draft.errOffline | Bağlantı yok. Yerel olarak kaydedildi — daha sonra tekrar deneyeceğiz. |

### Bot strings

| Key | tr |
|---|---|
| welcome.body | Majstr'a hoş geldiniz! 🛠\n\nBir usta bulun ya da kendinizi usta olarak kaydedin.\n\n👇 Dil seçin / Choose language / Scegli la lingua |
| btn.addMaster | ➕ Profil kartımı ekle |
| btn.loginSite | 🌐 Siteyi aç |
| lang.switched | ✅ Dil değiştirildi |
| unknownCommand | Bilinmeyen komut. Kullanılabilir:\n/start — başla\n/available — şu an müsait\n/nextweek — gelecek haftadan itibaren\n/busy — meşgul\n/status — durumu gör\n/languages — konuşulan diller |
| avail.none | Onaylanmış profil kartı bulunamadı. |
| avail.updated | Durum güncellendi: {label} |
| avail.available | 🟢 Şu an müsait |
| avail.next_week | 🟡 Gelecek haftadan itibaren |
| avail.busy | 🔴 Meşgul |
| status.line | 📋 Profiliniz:\nDurum: {avail}\nDiller: {langs}\n\nKomutlar:\n/available /nextweek /busy /languages |
| status.notset | belirtilmemiş |
| langs.prompt | Konuştuğunuz dilleri seçin (birden fazla seçilebilir): |
| langs.save | 💾 Kaydet |
| langs.saved | Diller kaydedildi: {labels} |
| owner.approved | ✅ Profil kartınız onaylandı ve yayınlandı!\n\nGörüntüle: {url} |
| owner.declined | ❌ Maalesef profil kartınız onaylanmadı. Bilgileri düzenleyip bot üzerinden tekrar gönderebilirsiniz. |

---

## Translator notes & questions

### Formality / address choice (per language)

- **Portuguese (pt) — formal "você" / implicit 3rd-person verb forms.**
  European Portuguese UI convention strongly favours the impersonal-polite
  register (verb forms like "Verifique", "Introduza", possessive "o seu"),
  which reads as respectful without being stiff. "Tu" would feel too casual
  and regionally uneven for a mixed migrant + Italian audience. Chosen
  consistently.
- **German (de) — informal "du".**
  Peer-to-peer craftsman community, app/Telegram context, and a warm
  community feel all point to "du". Modern German tech/community products
  (and most Telegram apps) use "du"; "Sie" would feel corporate and
  distancing. Chosen consistently.
- **French (fr) — formal "vous".**
  French has a strong norm of "vous" for any service/professional product
  addressing adults you don't know; "tu" risks reading as disrespectful to a
  tradesperson, especially across cultures. "Vous" here is warm-respectful,
  not corporate. Chosen consistently.
- **Turkish (tr) — formal-plural "siz" (2nd person plural verb endings).**
  Turkish "siz" is the default polite/respectful address for adults and
  service contexts; it is the safe, warm-respectful choice for a community of
  working professionals. "Sen" would feel too familiar for first contact.
  Chosen consistently.

### Terminology interpretations

- **"card" / "master card" / "Profilkarte" / "fiche" / "scheda" / "cartão" /
  "usta kartı".** Interpreted as the tradesperson's public profile listing on
  Majstr (not a payment card). Rendered as: pt "cartão (de profissional)",
  de "Profilkarte", fr "fiche (professionnelle)", tr "usta kartı". Note de/fr
  deliberately avoid a literal "Karte/carte" alone (would be ambiguous with
  payment/business card); pt and tr keep "cartão/kart" since uk/ru/it source
  also use the literal card metaphor — flag for consistency review.
- **"master" / "tradesperson" / "craftsman".** Bot welcome uses "tradesperson"
  in EN; rendered as artisan/Fachkraft/usta/profissional. tr keeps "usta"
  (the established word, matches the "usta kartı" listing concept). de uses
  "Fachkraft" (neutral, inclusive); fr "artisan/professionnel"; pt
  "profissional". Confirm "usta" vs "zanaatkâr" preference with a TR native.
- **"tags" → "services".** The tag editor (`tag.*`) and `bio.servicesLabel`
  both describe the same thing in-product (the 1–3 short service labels), so
  "tag" strings are translated as "service/Leistung/serviço/hizmet" for user
  clarity, matching the EN source which already says "Add a service".
- **"Mini App".** Kept as the Telegram product proper noun ("Mini App" /
  "Mini Uygulama" for tr). Confirm whether tr should keep English "Mini App".
- **`\n` sequences in bot strings.** Shown literally in the tables because the
  source stores them as escaped newlines in JS string literals; they must be
  entered as real `\n` escapes when copied into `backend/i18n.js`.

### For native reviewer / founder to confirm

1. German inclusive form "Kund:innen" — used for gender-neutrality; founder
   may prefer plain "Kunden" if brand voice favours simplicity. Easy swap.
2. Turkish "usta kartı" vs a softer "profil kartı" / "ustalık kartı" — "usta"
   can connote a senior master tradesman specifically; confirm it reads right
   for all trades (e.g. a junior electrician).
3. Portuguese: European vs Brazilian spelling confirmed as **European**
   ("contactos", "ficheiro", "Itália", "inspeção"). Confirm target market is
   PT-PT, not PT-BR.
4. fr "fiche" vs "carte" and pt "cartão" vs "ficha" — choose one metaphor
   platform-wide for cross-language consistency before launch.
5. de `step.bio` / `bio.aboutLabel` both = "Über dich" (matches EN reusing
   "About you"); confirm intentional duplication is fine.
6. `success.text` / `owner.approved` review status wording ("zur Prüfung",
   "validation", "incelenmek üzere") — confirm it matches the actual
   admin-approval UX described to users.

---

## Founder-approved binding decisions (2026-05-18) — APPLIED

These three decisions were approved by the founder and are now wired into
`frontend/src/onboarding/i18n.tsx` and `backend/i18n.js`. The tables above
already reflect them.

1. **One "card" term per language, used in EVERY string (wizard + bot):**
   pt = "cartão" · de = "Profilkarte" (never bare "Karte") · fr = "fiche" ·
   tr = "profil kartı".
2. **Turkish:** "usta kartı" → "profil kartı" for the owner's own listing
   everywhere. "usta" kept only in `welcome.body` (discovery: find/register
   *among* masters), never for the owner labeling their own card.
3. **Registers kept as proposed:** pt = você, de = du, fr = vous, tr = siz.
   In German, all "Kund:innen" → plain "Kunden". Also applied the referenced
   de tone polish: `submit.failTitle` → "Senden nicht möglich",
   `submit.errGeneric` → "Senden hat nicht geklappt. Bitte versuche es noch
   mal."

---

## Brand Guardian review

Reviewed against Majstr brand voice: warm, trustworthy, plain-spoken,
community-first, respectful peer-to-peer (talking WITH tradespeople, not down
to them); not corporate, not playful. Audience: real working tradespeople,
often on a phone via Telegram Mini App.

### Per-language verdict

| Language | Verdict | One-line rationale |
|---|---|---|
| Portuguese (pt) | **Revise** (minor) | Tone is warm and correct; only the "card" noun + 2 clarity items need fixing. |
| German (de) | **Revise** (minor) | "du" is the right call and reads warm; fix "Kund:innen", the "card" split, and one stiff string. |
| French (fr) | **Revise** (formality decision) | Clean and natural, but the vous/du mix across the brand is the real issue; "fiche" vs "cartão" split must be resolved. |
| Turkish (tr) | **Revise** (terminology) | Solid and respectful; "usta kartı" vs "kart" consistency and the "usta" connotation need a native sign-off. |

No language is rejected. All four are publishable after the prioritized
changes below. The biggest brand risks are **cross-language inconsistency**,
not in-language quality.

### Tone of voice assessment

- **pt** — The impersonal-polite register ("Verifique", "Introduza", "o seu")
  is warm-respectful and reads as plain Portuguese, not corporate. Good brand
  fit. `submit.failOk` "Entendido" is fine; matches EN "Got it".
- **de** — "du" is correct for a Telegram craftsman community and lands warm
  and peer-level. One string drifts corporate-stiff: `submit.errGeneric`
  "Senden fehlgeschlagen. Bitte versuche es erneut." — "fehlgeschlagen" is
  systems-speak. Most other strings are good and human.
- **fr** — "vous" is executed warmly (not cold-formal). Natural and
  trustworthy. `submit.failOk` "Compris" is good and human (better than the
  stiffer "J'ai compris").
- **tr** — "siz" is respectful and appropriate for first contact with adult
  professionals. Tone is consistent and warm. No corporate drift found.

Overall: no string is too casual or playful in any language. The only
tone defect class is occasional systems/IT phrasing in error strings (de
worst, others minor).

### Formality harmonization — RECOMMENDATION

The proposed mix (pt=você, de=du, fr=vous, tr=siz) is **defensible and should
be kept**. Harmonizing to one register across languages would be a mistake:
politeness norms are language-internal, not brand-internal. Forcing "tu" in
French to "match" German would read as disrespectful to a tradesperson;
forcing "Sie" in German to "match" French would read corporate and cold —
the exact opposite of the brand. The unifying principle is **not** the same
grammatical register, it is the same *felt relationship*: "a competent peer
talking with you respectfully." Each language already achieves that with its
own correct register.

**Decision: keep per-language registers as proposed.** Document the principle
("warm-respectful peer address, realized per language") in the brand glossary
so future translators don't try to standardize the pronoun. One consistency
rule to enforce: within a language the register must never switch — spot-check
done, all four are internally consistent.

### Cross-language glossary — DECISIONS

**1. "card" (the public profile listing).** This is the worst cross-language
inconsistency and a genuine trust/clarity risk: the same product object is
called four conceptually different things, and uk/ru/it source uses a literal
card metaphor while de/fr abandon it. The user-facing object should feel like
*one product concept* everywhere.

Decision — keep the card metaphor consistently, mapped to the most natural
literal-but-unambiguous noun per language:

| Lang | Use everywhere | Drop |
|---|---|---|
| pt | **cartão** (de profissional) | — (already consistent) |
| de | **Profilkarte** (everywhere, incl. bot `btn.addMaster`, `avail.none`, `owner.*`) | bare "Karte" |
| fr | **fiche** (everywhere) | "carte" |
| tr | **kart** — recommend **"profil kartı"** over "usta kartı" | "usta kartı" (see master note) |

Rule: each language picks ONE noun and uses it in *every* surface (wizard +
bot). de currently mixes "Profilkarte" and bare "Karte" — must unify to
**Profilkarte**. fr is already consistently "fiche" — keep, do not switch to
"carte". The metaphor need not be lexically identical across languages
(card/fiche differ), but it must map to the same concept and be invariant
within each language. fr "fiche" is acceptable because it is the natural FR
word for exactly this (a directory listing) — forcing "carte" would be the
ambiguous, off-brand choice the translator correctly avoided.

**2. "master" / tradesperson.** "Master card" in EN is internal jargon; the
public concept is "your professional profile/listing." Decision:

- Do **not** expose the word "master" to end users in pt/de/fr. Use:
  pt "profissional", de "Fachkraft", fr "artisan/professionnel" (as drafted).
- **tr: change "usta kartı" → "profil kartı".** "Usta" connotes a *senior
  master* specifically; a junior electrician registering will feel the label
  doesn't fit, which erodes trust at the exact moment of sign-up. Keep "usta"
  only where it means "find a worker" in discovery copy if a TR native
  confirms it reads inclusively; for the *owner's own listing* use neutral
  "profil kartı". Requires TR native confirmation (translator already flagged).
- Bot welcome "tradesperson" → artisan/Fachkraft/usta/profissional as drafted
  is fine (that is discovery-side, not the owner labeling their own card).

**3. "services" (the 1–3 tags).** Decision: **approved as-is.** Rendering
`tag.*` and `bio.servicesLabel` both as service/Leistung/serviço/hizmet is
correct, matches EN "Add a service", and removes the developer-jargon word
"tag" from the user's view. Enforce one noun per language: pt "serviço",
de "Leistung", fr "service", tr "hizmet" — all four are already consistent.
Keep `tag.*` keys in code but never surface the word "tag".

### Prioritized required changes

**P1 — trust / consistency (must fix before launch)**

1. `de` "card" noun — unify to **Profilkarte** everywhere. Specifically:
   `btn.addMaster` "Meine Karte hinzufügen" → "Meine Profilkarte hinzufügen";
   `success.text` "Deine Karte" → "Deine Profilkarte";
   `avail.none` "Profilkarte" (already ok);
   `owner.approved` "Deine Karte" → "Deine Profilkarte";
   `owner.declined` "deine Karte" → "deine Profilkarte".
2. `tr` master connotation — `submit.errExists`, `draft.errExists`,
   `avail.none`, `btn.addMaster`, `owner.approved`, `owner.declined`:
   "usta kartı" → "profil kartı" (pending TR-native confirmation the
   inclusive reading holds).
3. `fr` confirm "fiche" is used in **every** surface (wizard + bot) — it is;
   lock it. Do not change to "carte".

**P2 — tone polish**

4. `de` `submit.errGeneric` "Senden fehlgeschlagen. Bitte versuche es
   erneut." → "Senden hat nicht geklappt. Bitte versuche es noch mal."
   (warmer, less systems-speak; matches EN "Couldn't submit").
5. `de` `submit.failTitle` "Senden fehlgeschlagen" → "Senden nicht möglich"
   (parallels EN "Couldn't submit", less alarming).
6. `de` "Kund:innen" → **"Kundinnen und Kunden"** OR plain **"Kunden"**.
   Recommendation: **"Kunden"** — the colon-form is visually corporate/HR and
   renders awkwardly on small Mini App screens; plainness is on-brand.
   Affects `profile.nameHint`, `contact.hint`, `contact.phoneHint`.
7. `fr` `submit.errExists` "fiche professionnelle active" — fine, but align
   wording with `draft.errExists` (both already say "fiche professionnelle
   active"); confirm parallelism kept after any edits.

**P3 — clarity / accuracy (low risk, recommended)**

8. `pt` `step.bio` "Sobre si" vs `bio.aboutLabel` "Sobre si" — duplication
   matches EN intentionally; OK, no change. (Answers translator Q5 for pt.)
9. `de` `step.bio` / `bio.aboutLabel` both "Über dich" — intentional, OK.
10. `tr` `tag.noHash` "Başında # olmadan" reads slightly terse/robotic as a
    standalone hint; acceptable for a validation microcopy — leave, but if
    polishing, "Başına # koymayın" is more natural imperative.
11. Review-status wording (`success.text`, `owner.approved`,
    `owner.declined`): all four say "submitted for review / approved /
    not approved" consistently and match the admin-approval UX in CLAUDE.md.
    **Accurate — approved.** One nuance: `owner.declined` in all langs
    correctly tells the user they can edit and resubmit (matches the real
    flow). Good for trust.

### Accuracy / clarity risks checked

- "services/tags": resolved correctly, no jargon leak. ✅
- "review status": consistent and matches real approval flow; does not
  over-promise. ✅
- pt European spelling ("contactos", "ficheiro", "inspeção"): consistent;
  confirm PT-PT target market (translator Q3) — brand-wise PT-PT is the
  right call for an Italy/Portugal migrant audience. ✅
- "Mini App" / "Mini Uygulama": acceptable; recommend keeping English
  "Mini App" in tr too (it is the Telegram product proper noun and tr users
  encounter it in English in-app) — minor, founder call.
- No mistranslations that would mislead a tradesperson were found. The only
  trust-eroding items are the cross-language card/master inconsistencies
  (P1), not literal errors.

### Final glossary decision (lock before launch)

| Concept | pt | de | fr | tr |
|---|---|---|---|---|
| the listing ("card") | cartão | Profilkarte | fiche | profil kartı |
| the worker ("master") | profissional | Fachkraft | artisan/professionnel | usta (discovery only) |
| the 1–3 labels ("services") | serviço | Leistung | service | hizmet |
| address register | você (formal) | du (informal) | vous (formal) | siz (formal) |

Principle to document: *same product concept and same warm-respectful peer
relationship in every language; grammatical register realized per language,
never standardized across languages.*

---

**Brand Guardian**: review complete
**Date**: 2026-05-18
**Status**: All four languages → Revise (minor); none rejected. Safe to
launch after P1 fixes + TR-native confirmation on "profil kartı".
