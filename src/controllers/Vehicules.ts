import { Request, Response } from 'express';
import { Vehicule } from '../models/Vehicule';
import { NewVehiculeService } from '../models/NewVehiculeService';

export const getVehicules = async (req: Request, res: Response) => {
    try {
        const vehicules = await Vehicule.find();
        const date = new Date();

        let randomNumber = Math.floor(Math.random() * 4) + 1;
        const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();


        res.json({
            flyerDay: dayOfWeek,
            randomNumber: randomNumber,
            data: vehicules.map(item => ({
                ...item.toObject(),
                ville: item.ville,
            })),
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vehicules' });
    }
};

export const getANewVehicule = async (req: Request, res: Response) => {
    try {
        // Always select the vehicle with the oldest lastShownAt (or null)
        const vehicule = await NewVehiculeService.findOne().sort({ lastShownAt: 1 });
        if (!vehicule) {
            return res.status(404).json({ message: 'No new vehicules available for today\'s criteria' });
        }
        vehicule.lastShownAt = new Date();
        await vehicule.save();
        res.json({
            ...vehicule.toObject(),
            ville: vehicule.ville,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching a single new vehicule' });
    }
};




export const getAVehicule = async (req: Request, res: Response) => {
    try {
        const date = new Date();
        const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
        console.log(dayOfWeek);
        let vehicule = null;
        let query = {};

        if (dayOfWeek === 1) { // Monday
            query = { prix: { $gt: 500000 } };
            console.log('Monday: prix > 500000');
        } else if (dayOfWeek === 5) { // Friday
            query = { prix: { $lt: 500000 } };
            console.log('Friday: prix < 500000');
        } else {
            // For any other day, return 404 with a clear message
            return res.status(404).json({ message: 'No new vehicules available for today\'s criteria' });
        }

        vehicule = await Vehicule.findOne(query).sort();

        if (!vehicule) {
            return res.status(404).json({ message: 'No new vehicules available for today\'s criteria' });
        }

        vehicule.lastShownAt = new Date();
        await vehicule.save();
        
        const randomNumber = Math.floor(Math.random() * 4) + 1;

        res.json({
            flyerDay: dayOfWeek,
            randomNumber: randomNumber,
            data: {
                ...vehicule.toObject(),
                ville: vehicule.ville,
            },
        });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching a single new vehicule' });
    }
};

export const getTenVehicules = async (req: Request, res: Response) => {
    try {
        const vehicules = await Vehicule.find().sort({ lastShownAt: 1 }).limit(10);
        res.json(vehicules.map(item => ({
            ...item.toObject(),
            ville: item.ville,
        })));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching ten vehicules' });
    }
}
