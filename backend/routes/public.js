const Master = require('../database/schema/Master');
const Profession = require('../database/schema/Profession');
const ProfCategory = require('../database/schema/ProfCategory');
const Location = require('../database/schema/Location');
const Country = require('../database/schema/Country');
const Review = require('../database/schema/Review');
const { refCache } = require('../helpers/referenceCache');

// Handle various API data requests
async function handleApiRequests(req, res) {
  console.log(
    `=== API request to HTTP server at ${new Date().toUTCString()} ===`
  );

  // Whenever I need to fetch data, I am using URL params to define which data to send
  if (!req.query || !req.query.q) {
    return res.status(400).send('Missing query parameter');
  }

  if (req.query && req.query.q) {
    switch (req.query.q) {
      case 'masters':
        let mastersQuery = { status: 'approved' };
        if (req.query.country) {
          mastersQuery = { ...mastersQuery, countryID: req.query.country };
        }
        const masters = await Master.find(mastersQuery).sort({ _id: -1 });
        console.log(`Fetching masters for location`, req.query.country);
        res.status(200).send(masters);
        break;
      case 'newmasters':
        const newMasters = await Master.find({ status: 'pending' });
        console.log(`Fetching new masters...`);
        res.status(200).send(newMasters);
        break;
      case 'professions':
        // Same cache + keys as /api/reference/* — invalidated together.
        const professions = await refCache.get('professions', () => Profession.find());
        console.log(`Fetching professions...`);
        res.status(200).send(professions);
        break;
      case 'prof-categories':
        const profCategories = await refCache.get('prof-categories', () => ProfCategory.find());
        console.log(`Fetching professional categories...`);
        res.status(200).send(profCategories);
        break;
      case 'locations':
        const locationsQuery = req.query.country
          ? { countryID: req.query.country }
          : {};
        const locations = await refCache.get(`locations:${req.query.country || ''}`, () =>
          Location.find(locationsQuery)
        );
        console.log(`Fetching locations... country id:`, req.query.country);
        res.status(200).send(locations);
        break;
      case 'countries':
        const countries = await refCache.get('countries', () => Country.find());
        console.log(`Fetching countries...`);
        res.status(200).send(countries);
        break;
      case 'reviews':
        if (!req.query.master) {
          res.status(400).send('Missing master ID');
          break;
        }
        const reviews = await Review.find({ masterID: req.query.master }).sort({ createdAt: -1 });
        res.status(200).send(reviews);
        break;
      default:
        console.log(`Unknown request, sending 404...`);
        console.log('request url:', req.url);
        res.status(404).send('No such file!');
    }
  }
}

async function addReview(req, res) {
  const { masterID, authorName, rating, comment } = req.body;

  if (!masterID || !authorName || !rating) {
    return res.status(400).json({ error: 'masterID, authorName, and rating are required' });
  }
  const ratingNum = Number(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
  }

  const master = await Master.findById(masterID);
  if (!master || master.status !== 'approved') {
    return res.status(404).json({ error: 'Master not found' });
  }

  const review = new Review({ masterID, authorName, rating: ratingNum, comment: comment || '' });
  await review.save();

  // Recalculate aggregate rating on the master record
  const allReviews = await Review.find({ masterID });
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  master.rating = Math.round(avg * 10) / 10;
  master.reviewCount = allReviews.length;
  await master.save();

  console.log(`Review added for master ${masterID}: ${ratingNum}/5 by ${authorName}`);
  res.status(201).json({ success: true, review });
}

module.exports = { handleApiRequests, addReview };
