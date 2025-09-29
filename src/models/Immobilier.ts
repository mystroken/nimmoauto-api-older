import mongoose, { Document, Schema } from 'mongoose';

export interface IImmobilier extends Document {
    id: number;
    CategorieFr: string;
    CategorieEn: string;
    nom: string;
    prix: number;
    localisationGps?: string | null;
    localisationFr?: string | null;
    localisationEn?: string | null;
    superficie: number;
    placeassise?: number | null;
    chambre: number;
    douche?: number | null;
    description: string;
    image1: string;
    image2: string;
    image3: string;
    image4: string;
    image5?: string | null;
    lastShownAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const immobilierSchema = new Schema<IImmobilier>({
    id: {
        type: Number,
        default: null,
        unique: true,
    },
    CategorieFr: {
        type: String,
        default: null,
        trim: true,
    },
    CategorieEn: {
        type: String,
        default: null,
        trim: true,
    },
    nom: {
        type: String,
        default: null,
        trim: true,
    },
    prix: {
        type: Number,
        required: [true, 'Price is required'],
    },
    localisationGps: {
        type: String,
        default: null,
    },
    localisationFr: {
        type: String,
        default: null,
    },
    localisationEn: {
        type: String,
        default: null,
    },
    superficie: {
        type: Number,
        required: [true, 'Superficie is required'],
    },
    placeassise: {
        type: Number,
        default: null,
    },
    chambre: {
        type: Number,
        default: null,
    },
    douche: {
        type: Number,
        default: null,
    },
    description: {
        type: String,
        default: null,
    },
    image1: {
        type: String,
        default: null,
    },
    image2: {
        type: String,
        default: null,
    },
    image3: {
        type: String,
        default: null,
    },
    image4: {
        type: String,
        default: null,
    },
    image5: {
        type: String,
        default: null,
    },
    lastShownAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true
});

export const Immobilier = mongoose.model<IImmobilier>('Immobilier', immobilierSchema);