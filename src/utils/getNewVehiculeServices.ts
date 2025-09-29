import axios from 'axios';
import { CronJob } from 'cron';
import { Vehicule } from '../models/Vehicule';
import { NewVehiculeService } from '../models/NewVehiculeService';

console.log('🕒 Vehicle cron job scheduled to run every day at 5 AM.');

const job = new CronJob('0 5 * * *', async () => {
    console.log('🚀 Running vehicle cron job: Fetching and processing new vehicle services...');
    try {
        const response = await axios.get('https://nimmo-auto.com/api/v1/produits/vehicule/all');
        
        // Handle different response formats
        let items;
        if (response.data && Array.isArray(response.data.data)) {
            items = response.data.data;
        } else if (response.data && Array.isArray(response.data.result)) {
            items = response.data.result;
        } else if (Array.isArray(response.data)) {
            items = response.data;
        }

        if (!items || !Array.isArray(items)) {
            console.log('No vehicle items found or invalid format from API.');
            return;
        }

        // Task 1: Update the main 'Vehicule' collection with all historical data
        console.log('🔄 Updating historical vehicle data...');
        const historicalOps = items.map((item: any) => {
            const updateData = { ...item };
            // Ensure lastShownAt is not overwritten by the API data
            delete updateData.lastShownAt;
            // Ensure villeFr and villeEn are present if available
            if (item.villeFr) updateData.villeFr = item.villeFr;
            if (item.villeEn) updateData.villeEn = item.villeEn;
            return {
                updateOne: {
                    filter: { id: item.id },
                    update: { $set: updateData },
                    upsert: true
                }
            };
        });

        if (historicalOps.length > 0) {
            const result = await Vehicule.bulkWrite(historicalOps);
            console.log('✅ Historical vehicle data updated successfully!');
            console.log(`- ${result.upsertedCount} new vehicles added to history.`);
            console.log(`- ${result.modifiedCount} existing vehicles updated in history.`);
        }

        // Task 2: Override the 'NewVehiculeService' collection with the latest data
        console.log('🔄 Overriding new vehicle services table...');
        await NewVehiculeService.deleteMany({});
        console.log('- Old new vehicle services cleared.');

        if (items.length > 0) {
            // Ensure villeFr and villeEn are present if available
            const insertItems = items.map((item: any) => {
                const insertData = { ...item };
                if (item.villeFr) insertData.villeFr = item.villeFr;
                if (item.villeEn) insertData.villeEn = item.villeEn;
                return insertData;
            });
            await NewVehiculeService.insertMany(insertItems);
            console.log(`- ${items.length} new vehicle services inserted.`);
        }

        console.log('✅ Vehicle cron job finished successfully!');

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error during vehicle cron job (Axios):', error.message);
        } else {
            console.error('An unexpected error occurred during vehicle cron job:', error);
        }
    }
});

job.start();