export interface BrregEnhet {
  organisasjonsnummer: string
  navn: string
  organisasjonsform: {
    kode: string
    beskrivelse: string
  }
  forretningsadresse?: {
    adresse?: string[]
    postnummer?: string
    poststed?: string
    kommune?: string
  }
}

export interface BrregRolle {
  type: {
    kode: string
    beskrivelse: string
  }
  person?: {
    navn: {
      fornavn: string
      mellomnavn?: string
      etternavn: string
    }
    fodselsdato?: string
  }
  fratraadt: boolean
}

export interface BrregRollegruppe {
  type: {
    kode: string
    beskrivelse: string
  }
  roller: BrregRolle[]
}

export interface BrregRollerResponse {
  rollegrupper: BrregRollegruppe[]
}
