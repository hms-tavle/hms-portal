insert into public.task_templates
  (category, category_label, title, description, legal_basis, recurrence, requires_professional, is_conditional, sort_order)
values

-- ── Category 1: Internkontroll ──────────────────────────────────────────────
('internkontroll', 'Internkontroll (HMS-system)',
 'Etablere og vedlikeholde skriftlig HMS-system',
 'Dokumenter HMS-mål, organisasjonsstruktur, ansvarsfordeling, risikovurderinger, avviksprosedyrer og rutiner for systematisk oppfølging.',
 'Internkontrollforskriften §§ 4–5',
 'annually', false, false, 100),

('internkontroll', 'Internkontroll (HMS-system)',
 'Årlig gjennomgang av HMS-system',
 'Gjennomfør formell gjennomgang av hele HMS-systemet. Oppdater dokumentasjonen ved behov. Protokollér gjennomgangen.',
 'Internkontrollforskriften § 5, punkt 8',
 'annually', false, false, 110),

('internkontroll', 'Internkontroll (HMS-system)',
 'Risikovurdering og kartlegging av farer',
 'Identifiser farer i alle fellesarealer og installasjoner. Vurder sannsynlighet og konsekvens. Iverksett tiltak. Oppdater risikoregisteret.',
 'Internkontrollforskriften § 5, punkt 6',
 'annually', false, false, 120),

('internkontroll', 'Internkontroll (HMS-system)',
 'Avviksbehandling og korrigerende tiltak',
 'Logg og behandle avvik fra HMS-krav. Sørg for at beboere kan melde feil. Dokumenter tiltak og oppfølging.',
 'Internkontrollforskriften § 5, punkt 7',
 'per_project', false, false, 130),

-- ── Category 2: Brannvern ───────────────────────────────────────────────────
('brannvern', 'Brannvern',
 'Test røykvarslere i fellesarealer',
 'Test funksjon på alle røykvarslere i fellesarealer. Skift batterier ved behov. Skift ut varslere eldre enn 10 år.',
 'Forskrift om brannforebygging § 7; Brann- og eksplosjonsvernloven § 6',
 'annually', false, false, 200),

('brannvern', 'Brannvern',
 'Brannslukker – visuell kontroll',
 'Visuell kontroll av alle slukkere: manometer, slange, sikring, pulvertilstand. Dokumentér tilstand.',
 'Forskrift om brannforebygging § 7',
 'twice_yearly', false, false, 210),

('brannvern', 'Brannvern',
 'Brannslukker – faglig service',
 'Profesjonell service av brannslukker utføres av godkjent fagperson. Pulver: hvert 5. år. CO₂: hvert 10. år.',
 'Forskrift om brannforebygging §§ 5, 7',
 'every_5_years', true, false, 220),

('brannvern', 'Brannvern',
 'Brannslangetrommler – inspeksjon',
 'Inspeksjon av brannslangetrommler utført av sertifisert brannvernfirma.',
 'Forskrift om brannforebygging §§ 5, 7; Brann- og eksplosjonsvernloven § 6',
 'annually', true, false, 230),

('brannvern', 'Brannvern',
 'Brannalarmanlegg – årlig service',
 'Årlig inspeksjon og funksjonstest av brannalarmanlegget. Verifiser automatisk alarmoverføring. Utføres av FG-godkjent firma.',
 'Forskrift om brannforebygging § 5; NS 3960',
 'annually', true, false, 240),

('brannvern', 'Brannvern',
 'Sprinkleranlegg – inspeksjon og service',
 'Årlig inspeksjon av FG-godkjent inspektør. Rapport registreres i FG-kontroll.',
 'Forskrift om brannforebygging § 5; NS-EN 12845; FG-930:1',
 'annually', true, true, 250),

('brannvern', 'Brannvern',
 'Nødlys og ledelys – inspeksjon',
 'Inspeksjon av alt nødlys og ledelys i trapperom og fellesarealer. Verifiser automatisk aktivering ved strømbrudd.',
 'TEK17; NEK EN 50172; NS-EN 1838',
 'annually', false, false, 260),

('brannvern', 'Brannvern',
 'Rømningsveier – inspeksjon',
 'Inspiser alle rømningsveier, trapperom og nødutganger. Kontroller at disse er ryddige, riktig skiltet og tilgjengelige.',
 'Forskrift om brannforebygging §§ 5, 9',
 'twice_yearly', false, false, 270),

('brannvern', 'Brannvern',
 'Brannvernrunde',
 'Systematisk gjennomgang av alle fellesarealer og trapperom. Kontroller brannceller, branndører og at rømningsveier ikke er blokkert.',
 'Forskrift om brannforebygging §§ 5, 9, 10',
 'twice_yearly', false, false, 280),

('brannvern', 'Brannvern',
 'Branninformasjon til beboere',
 'Del ut brannsikkerhetsinformasjon til alle beboere. Informer om utstyr, rømningsveier og individuelle plikter.',
 'Forskrift om brannforebygging § 4',
 'annually', false, false, 290),

('brannvern', 'Brannvern',
 'Pipefeining og ildstedskontroll',
 'Kommunen arrangerer pipefeining. Styret plikter å gi tilgang og melde fra om nye ildsteder.',
 'Forskrift om brannforebygging §§ 6, 17',
 'per_project', false, true, 295),

-- ── Category 3: Elektriske anlegg ──────────────────────────────────────────
('elektriske_anlegg', 'Elektriske anlegg',
 'Elektrokontroll av fellesanlegg',
 'Inspeksjon av alle elektriske anlegg i fellesarealer og utendørsanlegg (trapperom, kjeller, parkering, elbillading, utvendig belysning) etter NEK 405-standarden. Utføres av kvalifisert elektriker.',
 'Internkontrollforskriften § 5; El-tilsynslova',
 'every_5_years', true, false, 300),

-- ── Category 4: Heis (conditional) ─────────────────────────────────────────
('heis', 'Heis',
 'Periodisk sikkerhetssjekk av heis',
 'Uavhengig sikkerhetskontroll av akkreditert kontrollorgan (SKO), f.eks. Norsk Heiskontroll eller Kiwa. Funn rapporteres til NIREG og eier.',
 'Plan- og bygningsloven § 29-9; TEK17 §§ 16-1, 16-2',
 'every_2_years', true, true, 400),

('heis', 'Heis',
 'Rutineservice av heis',
 'Daglig visuell kontroll for ytre skader og normal funksjon. Rutineservice etter NS-EN 13015 utføres av heisservicefirma.',
 'TEK17 § 16-1; NS-EN 13015',
 'monthly', true, true, 410),

('heis', 'Heis',
 'Rapportering av heisulykker og -hendelser',
 'Ulykker eller alvorlige hendelser meldes umiddelbart til kommunen og NIREG. Driften stanses til sikkerhetskontrollen godkjenner gjenoppstart.',
 'TEK17 § 16-1',
 'per_project', false, true, 420),

-- ── Category 5: Lekeplass (conditional) ────────────────────────────────────
('lekeplass', 'Lekeplass',
 'Rutinekontroll av lekeplass',
 'Visuell kontroll for åpenbare farer: knuste deler, skarpe kanter, farlig rusk, innklemningsrisiko, hærverk.',
 'Produktkontrolloven; NS-EN 1176',
 'monthly', false, true, 500),

('lekeplass', 'Lekeplass',
 'Funksjonskontroll av lekeplass',
 'Detaljert kontroll av slitasje på bevegelige deler, festemidler, korrosjon og fallunderlagsdybde.',
 'NS-EN 1176; Internkontrollforskriften',
 'quarterly', false, true, 510),

('lekeplass', 'Lekeplass',
 'Hovedkontroll av lekeplass',
 'Strukturell integritetsvurdering av sertifisert lekeplasskontrollør. Resultat i formell rapport med utbedringsliste.',
 'NS-EN 1176; Produktkontrolloven',
 'annually', true, true, 520),

-- ── Category 6: Ventilasjon ─────────────────────────────────────────────────
('ventilasjon', 'Ventilasjon',
 'Filterbytte og service av ventilasjonsanlegg',
 'Skift filtre og utfør service på ventilasjonsanlegget. Dokumentér med servicerapport.',
 'Internkontrollforskriften § 5; TEK17',
 'annually', false, false, 600),

('ventilasjon', 'Ventilasjon',
 'Kanalrens av ventilasjonskanaler',
 'Profesjonell rengjøring av alle ventilasjonskanaler for å fjerne støv, bakterier og forurensninger.',
 'Internkontrollforskriften § 5; TEK17 inneklimakrav',
 'every_5_7_years', true, false, 610),

-- ── Category 7: Rørlegger / vann ───────────────────────────────────────────
('ror_vann', 'Rørlegger / vann',
 'Stoppekraninspeksjon',
 'Inspiser og test hovedstoppekraner og stoppekraner i alle enheter. Verifiser at kranene er tilgjengelige og tydelig merket.',
 'Internkontrollforskriften § 5; TEK17 § 15-6',
 'annually', false, false, 700),

-- ── Category 8: Radon (conditional) ────────────────────────────────────────
('radon', 'Radon',
 'Radonmåling',
 'Mål radonkonsentrasjon i underetasje og lavere etasjer. Obligatorisk for utleieenheter. Måling skjer 15. oktober–15. april over minimum 2 måneder. Tiltak kreves ved >100 Bq/m³.',
 'Strålevernforskriften; Borettslagsloven § 5-17; Eierseksjonsloven § 40',
 'every_10_years', false, true, 800),

-- ── Category 9: Byggeprosjekter ─────────────────────────────────────────────
('byggeprosjekter', 'Byggeprosjekter',
 'SHA-plan for rehabiliterings- og byggeprosjekter',
 'Utarbeid skriftlig SHA-plan (Sikkerhet, Helse og Arbeidsmiljø) før oppstart av ethvert vesentlig byggeprosjekt. Styret opptrer som byggherre og plikter å sikre at entreprenøren etterlever planen.',
 'Byggherreforskriften §§ 6, 8',
 'per_project', false, false, 900),

-- ── Category 10: Styrearbeid / forvaltning ─────────────────────────────────
('styrearbeid', 'Styrearbeid / forvaltning',
 'Ordinær generalforsamling / årsmøte',
 'Avhold ordinær generalforsamling (borettslag) eller årsmøte (sameie) innen utgangen av juni. Agenda: årsregnskap, årsberetning, styrevalg og øvrige lovpålagte saker.',
 'Borettslagsloven § 7-4; Eierseksjonsloven § 41',
 'annually', false, false, 1000),

('styrearbeid', 'Styrearbeid / forvaltning',
 'Årsregnskap og årsberetning',
 'Utarbeid og legg frem årsregnskap og årsberetning for generalforsamlingen innen 6 måneder etter regnskapsårets slutt.',
 'Borettslagsloven § 10-1; Eierseksjonsloven § 44; Regnskapsloven',
 'annually', false, false, 1010),

('styrearbeid', 'Styrearbeid / forvaltning',
 'Vedlikeholdsplan',
 'Vedlikehold en rullerende vedlikeholdsplan for bygningens tilstand og planlagt fremtidig vedlikehold. Oppdater planen årlig.',
 'Borettslagsloven § 5-17; Eierseksjonsloven § 40',
 'annually', false, false, 1020);
