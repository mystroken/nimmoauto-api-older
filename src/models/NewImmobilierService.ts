import mongoose, { Document, Schema } from 'mongoose';
import { IImmobilier } from './Immobilier'; 

const newImmobilierServiceSchema = new Schema<IImmobilier>({
    id: {
        type: Number,
        required: [true, 'ID is required'],
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
        default: null,
    },
    localisationGps: {
        type: String,
        default: null,
    },
    localisationFr: { type: String, default: null },
    localisationEn: { type: String, default: null },
    superficie: {
        type: Number,
        default: null,
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
        trim: true,
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

export const NewImmobilierService = mongoose.model<IImmobilier>('NewImmobilierService', newImmobilierServiceSchema); 