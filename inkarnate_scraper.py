from playwright.sync_api import sync_playwright
import urllib.request
import os

def main():
    # Créer le dossier pour sauvegarder les images
    os.makedirs('inkarnate_maps', exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        print("Navigation vers la page de connexion...")
        page.goto("https://inkarnate.com/login", wait_until="networkidle")
        
        # Mettre le script en pause pour vous laisser le temps de vous connecter
        input("\n>>> Veuillez vous connecter dans la fenêtre du navigateur.\n>>> ATTENDEZ d'être redirigé vers l'accueil (dashboard), puis revenez dans ce terminal et appuyez sur ENTRÉE pour lancer le téléchargement... <<<\n")
        
        print("Navigation vers Inkarnate Explore...")
        try:
            # On utilise "domcontentloaded" plutôt que "networkidle" car la redirection après connexion 
            # peut interrompre le chargement et causer une erreur.
            page.goto("https://inkarnate.com/explore", wait_until="domcontentloaded")
        except Exception as e:
            # On ignore l'erreur si la page a quand même pu charger
            print(f"Note : {e}")
        
        # Attendre le chargement initial des éléments
        page.wait_for_timeout(5000)

        # Défiler la page pour charger plus de cartes
        nb_scrolls = 5
        print(f"Défilement vers le bas ({nb_scrolls} fois) pour charger le contenu...")
        for i in range(nb_scrolls):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(3000) 

        # Extraire toutes les balises <img>
        images = page.locator("img").all()
        image_urls = set()
        
        for img in images:
            src = img.get_attribute("src")
            if src and not src.endswith(".svg"):
                image_urls.add(src)

        urls = list(image_urls)
        print(f"Trouvé {len(urls)} images. Début du téléchargement...")
        
        for idx, url in enumerate(urls):
            try:
                if url.startswith('/'):
                    url = f"https://inkarnate.com{url}"
                
                filename = f"inkarnate_maps/carte_{idx}.jpg"
                urllib.request.urlretrieve(url, filename)
                print(f"[{idx+1}/{len(urls)}] Téléchargé: {filename}")
            except Exception as e:
                print(f"Erreur lors du téléchargement de {url}: {e}")

        print("Terminé !")
        browser.close()

if __name__ == "__main__":
    main()
