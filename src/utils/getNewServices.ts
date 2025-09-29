import axios from 'axios';
import { CronJob } from 'cron';
import { Immobilier } from '../models/Immobilier';
import { NewImmobilierService } from '../models/NewImmobilierService';

console.log('🕒 Cron job scheduled to run every day at 5 AM.');

const job = new CronJob('0 5 * * *', async () => {
    console.log('🚀 Running cron job: Fetching and processing new services...');
    try {
        const response = await axios.get('https://nimmo-auto.com/api/v1/produits/immobilier/all');
        
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
            console.log('No items found or invalid format from API.');
            return;
        }

        // Task 1: Update the main 'Immobilier' collection with all historical data
        console.log('🔄 Updating historical data...');
        const historicalOps = items.map((item: any) => {
            const updateData = { ...item };
            // Ensure lastShownAt is not overwritten by the API data
            delete updateData.lastShownAt;

            return {
                updateOne: {
                    filter: { id: item.id },
                    update: { $set: updateData },
                    upsert: true
                }
            };
        });

        if (historicalOps.length > 0) {
            const result = await Immobilier.bulkWrite(historicalOps);
            console.log('✅ Historical data updated successfully!');
            console.log(`- ${result.upsertedCount} new items added to history.`);
            console.log(`- ${result.modifiedCount} existing items updated in history.`);
        }

        // Task 2: Override the 'NewImmobilierService' collection with the latest data
        console.log('🔄 Overriding new services table...');
        await NewImmobilierService.deleteMany({});
        console.log('- Old new services cleared.');

        if (items.length > 0) {
            await NewImmobilierService.insertMany(items);
            console.log(`- ${items.length} new services inserted.`);
        }

        console.log('✅ Cron job finished successfully!');

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error during cron job (Axios):', error.message);
        } else {
            console.error('An unexpected error occurred during cron job:', error);
        }
    }
});

job.start();