'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import PageRapport from '@/components/rapport/PageRapport';
import ContenuPageModele from '@/components/rapport/ContenuPageModele';
import EditeurTexteRiche from '@/components/rapport/EditeurTexteRiche';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatPhoneDisplay } from '@/lib/import/normalize';
import {
  DESC_DISPOSITION,
  DISPOSITIONS_PAGE,
  LIBELLE_DISPOSITION,
  MAX_POINTS_CLES,
  MIN_POINTS_CLES,
  nomDepuisContenu,
  type ContenuPageModele as Contenu,
  type CoteImage,
  type PointCle,
} from '@/lib/rapport/modele';
import {
  nomAgentAffiche,
  nomCommercialAgence,
  normaliserCouleurPrincipale,
  type IdentiteAgenceRapport,
  type IdentiteAgentRapport,
} from '@/lib/rapport/identite';
import type { PageBibliotheque } from '@/lib/rapport/pages';
import type { DispositionPageAgence } from '@/types/database';
import type { AgencyRow, ContextualProfile } from '@/types/database';

const inputClass =
  'w-full rounded-lg border border-black/10 px-[14px] py-[10px] text-[14px] text-ink placeholder:text-mute/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';
const labelClass = 'mb-1.5 block font-medium text-gray-700';

function contenuVide(): Contenu {
  return { imageCote: 'droite', points: [{ intitule: '', description: '' }, { intitule: '', description: '' }, { intitule: '', description: '' }] };
}

function pointsDepuis(page: PageBibliotheque | null): PointCle[] {
  const existing = page?.contenu.points ?? [];
  const padded = [...existing];
  while (padded.length < MIN_POINTS_CLES) padded.push({ intitule: '', description: '' });
  return padded.slice(0, MAX_POINTS_CLES);
}

export default function EditeurPageAgence({
  open,
  page,
  agency,
  profile,
  loginEmail,
  logoUrl,
  onClose,
  onSaved,
}: {
  open: boolean;
  page: PageBibliotheque | null;
  agency: AgencyRow;
  profile: ContextualProfile;
  loginEmail: string;
  logoUrl: string | null;
  onClose: () => void;
  onSaved: (saved: PageBibliotheque) => void;
}) {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [disposition, setDisposition] = useState<DispositionPageAgence>('texte');
  const [nom, setNom] = useState('');
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState(page?.contenu.corps ?? []);
  const [imageCote, setImageCote] = useState<CoteImage>('droite');
  const [points, setPoints] = useState<PointCle[]>(() => pointsDepuis(page));
  const [imageFichier, setImageFichier] = useState<File | null>(null);
  const [imageLocale, setImageLocale] = useState<string | null>(null);
  const [retirerImage, setRetirerImage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisposition(page?.disposition ?? 'texte');
    setNom(page?.nom ?? '');
    setTitre(page?.contenu.titre ?? '');
    setCorps(page?.contenu.corps ?? []);
    setImageCote(page?.contenu.imageCote ?? 'droite');
    setPoints(pointsDepuis(page));
    setImageFichier(null);
    setImageLocale(null);
    setRetirerImage(false);
    setErreur(null);
  }, [open, page]);

  useEffect(() => {
    if (!imageFichier) return;
    const url = URL.createObjectURL(imageFichier);
    setImageLocale(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFichier]);

  const contenu: Contenu = useMemo(
    () => ({
      titre: titre.trim() || undefined,
      corps,
      imageCote,
      points,
    }),
    [titre, corps, imageCote, points],
  );

  const agence: IdentiteAgenceRapport = {
    nom: agency.name,
    nomCommercial: nomCommercialAgence(agency.name, agency.nom_commercial),
    adresse: agency.address,
    telephone: agency.phone ? formatPhoneDisplay(agency.phone) : null,
    email: agency.email,
    siteWeb: agency.site_web ?? null,
    logoUrl,
    couleurPrincipale: normaliserCouleurPrincipale(agency.couleur_principale),
  };
  const agent: IdentiteAgentRapport = {
    nom: nomAgentAffiche(profile.first_name, profile.last_name),
    email: profile.email_pro?.trim() || loginEmail || null,
    telephone: profile.phone ? formatPhoneDisplay(profile.phone) : null,
    photoUrl: profile.avatar_url ?? null,
  };
  const accent = agence.couleurPrincipale;
  const imagePreview = imageLocale ?? (retirerImage ? null : page?.previewUrl ?? null);
  const edition = Boolean(page);

  async function enregistrer() {
    setBusy(true);
    setErreur(null);
    try {
      const form = new FormData();
      form.append('disposition', disposition);
      form.append('nom', nom.trim() || nomDepuisContenu(contenu, disposition));
      form.append('contenu', JSON.stringify(contenu));
      if (imageFichier) form.append('file', imageFichier);
      if (retirerImage && !imageFichier) form.append('retirerImage', '1');
      const url = edition
        ? `/api/dashboard/rapport/bibliotheque/${page!.id}`
        : '/api/dashboard/rapport/bibliotheque';
      const res = await fetch(url, { method: edition ? 'PATCH' : 'POST', body: form });
      const data = (await res.json()) as { page?: PageBibliotheque; error?: string };
      if (!res.ok || !data.page) throw new Error(data.error ?? 'Enregistrement impossible');
      notifySuccess(edition ? 'Page enregistrée' : 'Page créée');
      onSaved(data.page);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enregistrement impossible';
      setErreur(message);
      notifyError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edition ? 'Modifier la page' : 'Créer une page'}
      description="Choisissez une disposition, remplissez le contenu. La mise en page est fixe."
      maxWidth="3xl"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className={labelClass}>Disposition</legend>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Disposition">
              {DISPOSITIONS_PAGE.map((id) => {
                const active = disposition === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDisposition(id)}
                    className={`rounded-clay px-2.5 py-2 text-left shadow-clay-sm transition-colors ${
                      active
                        ? 'bg-white text-text-strong ring-1 ring-black/10'
                        : 'bg-surface-2 text-text-muted hover:bg-white/80 hover:text-text'
                    }`}
                  >
                    <span className="block text-[13px] font-semibold text-balance">{LIBELLE_DISPOSITION[id]}</span>
                    <span className="mt-0.5 block text-[11.5px] text-pretty text-mute">{DESC_DISPOSITION[id]}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="page-nom" className={labelClass}>
              Nom dans la bibliothèque
            </label>
            <input
              id="page-nom"
              className={inputClass}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={nomDepuisContenu(contenu, disposition)}
            />
          </div>

          <div>
            <label htmlFor="page-titre" className={labelClass}>
              {disposition === 'image' ? 'Titre (optionnel)' : 'Titre'}
            </label>
            <input
              id="page-titre"
              className={inputClass}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={disposition === 'image' ? 'Laisser vide si l’image se suffit' : 'Notre méthode'}
            />
          </div>

          {disposition === 'texte' || disposition === 'texte_image' ? (
            <EditeurTexteRiche
              key={`${page?.id ?? 'new'}-${open}`}
              value={corps}
              onChange={setCorps}
              label="Texte"
              hint="Gras, italique, listes. Pas de police ni de taille à régler."
            />
          ) : null}

          {disposition === 'texte_image' || disposition === 'image' ? (
            <div>
              <p className={labelClass}>Image</p>
              <input
                id={fileId}
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="sr-only"
                onChange={(e) => {
                  setImageFichier(e.target.files?.[0] ?? null);
                  setRetirerImage(false);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-ink hover:bg-black/[0.04]"
                  onClick={() => fileRef.current?.click()}
                >
                  {imagePreview ? 'Remplacer l’image' : 'Choisir une image'}
                </button>
                {imagePreview ? (
                  <button
                    type="button"
                    className="text-[13px] text-mute hover:text-ink"
                    onClick={() => {
                      setImageFichier(null);
                      setImageLocale(null);
                      setRetirerImage(true);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                  >
                    Retirer l’image
                  </button>
                ) : null}
              </div>
              {disposition === 'texte_image' ? (
                <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Côté de l’image">
                  {(['gauche', 'droite'] as const).map((cote) => (
                    <button
                      key={cote}
                      type="button"
                      role="radio"
                      aria-checked={imageCote === cote}
                      onClick={() => setImageCote(cote)}
                      className={`rounded-clay px-3 py-1.5 text-[13px] font-medium ${
                        imageCote === cote
                          ? 'bg-white text-text-strong shadow-clay-sm ring-1 ring-black/10'
                          : 'bg-surface-2 text-text-muted'
                      }`}
                    >
                      {cote === 'gauche' ? 'Image à gauche' : 'Image à droite'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {disposition === 'points' ? (
            <div>
              <p className={labelClass}>Points clés</p>
              <ul className="flex flex-col gap-3">
                {points.map((point, i) => (
                  <li key={i} className="rounded-clay border border-black/[0.06] bg-[#F7F6F4] p-2.5">
                    <label className="sr-only" htmlFor={`point-int-${i}`}>
                      Intitulé {i + 1}
                    </label>
                    <input
                      id={`point-int-${i}`}
                      className={inputClass}
                      value={point.intitule}
                      onChange={(e) =>
                        setPoints((prev) => prev.map((p, j) => (j === i ? { ...p, intitule: e.target.value } : p)))
                      }
                      placeholder="Intitulé"
                    />
                    <label className="sr-only" htmlFor={`point-desc-${i}`}>
                      Description {i + 1}
                    </label>
                    <input
                      id={`point-desc-${i}`}
                      className={`${inputClass} mt-1.5`}
                      value={point.description}
                      onChange={(e) =>
                        setPoints((prev) =>
                          prev.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)),
                        )
                      }
                      placeholder="Une ligne de description"
                    />
                    {points.length > MIN_POINTS_CLES ? (
                      <button
                        type="button"
                        className="mt-1.5 text-[12.5px] text-mute hover:text-ink"
                        onClick={() => setPoints((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Retirer ce point
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {points.length < MAX_POINTS_CLES ? (
                <button
                  type="button"
                  className="mt-2 text-[13px] font-medium text-ink hover:underline"
                  onClick={() => setPoints((prev) => [...prev, { intitule: '', description: '' }])}
                >
                  Ajouter un point
                </button>
              ) : null}
            </div>
          ) : null}

          {erreur ? (
            <p className="text-pretty text-[13px] text-red-700" role="alert">
              {erreur}
            </p>
          ) : null}

          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            style={{ padding: '10px 20px', fontSize: 14, borderRadius: 10 }}
            disabled={busy}
            onClick={() => void enregistrer()}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-gray-700">Aperçu</p>
          <PageRapport
            agence={agence}
            agent={agent}
            bien={{ adresse: null, ville: null }}
            page={1}
            pages={1}
          >
            <ContenuPageModele
              disposition={disposition}
              contenu={contenu}
              imageUrl={imagePreview}
              accent={accent}
            />
          </PageRapport>
        </div>
      </div>
    </Modal>
  );
}
