import { Request, Response } from 'express';
import { Immobilier } from '../models/Immobilier';
import { NewImmobilierService } from '../models/NewImmobilierService';

export const getImmobilier = async (req: Request, res: Response) => {
    try {
        const immobilier = await Immobilier.find();
        res.json(immobilier.map(item => ({
            ...item.toObject(),
            localisationFr: item.localisationFr,
            localisationGps: item.localisationGps,
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching immobilier' });
    }
}

export const getANewImmobilier = async (req: Request, res: Response) => {
    try {
        const immobilier = await NewImmobilierService.findOne().sort({ lastShownAt: 1 });
        if (!immobilier) {
            return res.status(404).json({ message: 'No new immobiliers available for today\'s criteria' });
        }
        immobilier.lastShownAt = new Date();
        await immobilier.save();
        res.json({
            ...immobilier.toObject(),
            localisationFr: immobilier.localisationFr,
            localisationGps: immobilier.localisationGps,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching a single new immobilier' });
    }
}

export const getAnImmobilier = async (req: Request, res: Response) => {
    try {
        const date = new Date();
        let dayOfWeek = date.getDay(); // 0 (Sunday) - 6 (Saturday)
        if (dayOfWeek === 0) dayOfWeek = 7; // Treat Sunday as 7

        let immobilier = null;
        let query = {};

        switch (dayOfWeek) {
            case 1: // Tuesday
                query = { CategorieFr: /meublé/i };
                console.log('Tuesday: CategorieFr contains "meublé"');
                break;
            case 3: // Wednesday
                query = { CategorieFr: /terrain/i };
                console.log('Wednesday: CategorieFr contains "terrain"');
                break;
            case 4: // Thursday
                query = { CategorieFr: /maison/i };
                console.log('Thursday: CategorieFr contains "maison"');
                break;
            case 5: // Friday
                query = { CategorieFr: /fête/i };
                console.log('Friday: CategorieFr contains "fête"');
                break;
            case 6: // Sunday
                query = { CategorieFr: /terrain/i };
                console.log('Sunday: CategorieFr contains "terrain"');
                break;
            default:
                // Monday (1) or Saturday (6) - No specific immobiliers
                return res.status(404).json({ message: 'No new immobiliers available for today\'s criteria' });
        }

        immobilier = await Immobilier.findOne(query).sort({ lastShownAt: 1 });

        if (!immobilier) {
            return res.status(404).json({ message: 'No new immobiliers available for today\'s criteria' });
        }

        // Update last shown date
        immobilier.lastShownAt = new Date();
        await immobilier.save();
        
        const randomNumber = Math.floor(Math.random() * 4) + 1;

        res.json({
            flyerDay: dayOfWeek,
            randomNumber,
            data: {
                ...immobilier.toObject(),
                localisationFr: immobilier.localisationFr,
                localisationGps: immobilier.localisationGps,
            },
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching a single new immobilier' });
    }
};

export const getTenImmobiliers = async (req: Request, res: Response) => {
    try {
        const immobiliers = await Immobilier.find().sort({ lastShownAt: 1 }).limit(10);
        res.json(immobiliers.map(item => ({
            ...item.toObject(),
            localisationFr: item.localisationFr,
            localisationGps: item.localisationGps,
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ten immobiliers' });
    }
}



