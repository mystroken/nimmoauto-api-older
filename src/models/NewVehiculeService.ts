import mongoose, { Document, Schema } from 'mongoose';
import { IVehicule } from './Vehicule'; // Reuse the same interface

const newVehiculeServiceSchema = new Schema<IVehicule>({
    id: {
        type: Number,
        required: [true, 'ID is required'],
        unique: true,
    },
    CategorieFr: {
        type: String,
        required: [true, 'French category is required'],
        trim: true,
    },
    CategorieEn: {
        type: String,
        required: [true, 'English category is required'],
        trim: true,
    },
    modeleFr: { type: String, trim: true },
    modeleEn: { type: String, trim: true },
    marqueFr: { type: String, trim: true },
    marqueEn: { type: String, trim: true },
    nom: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    prix: {
        type: Number,
        required: [true, 'Price is required'],
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
    ville: { type: String, trim: true },
    villeFr: { type: String, trim: true },
    villeEn: { type: String, trim: true },
}, {
    timestamps: true
});

export const NewVehiculeService = mongoose.model<IVehicule>('NewVehiculeService', newVehiculeServiceSchema); 