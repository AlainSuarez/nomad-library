// One address for everyone. Passkeys are tied to the domain, so every visit
// to the pages.dev address moves over to the real one before anything happens.
const HOME = "library.nomadovernormal.com";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === "nomad-library.pages.dev") {
    url.hostname = HOME;
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
