const Master = require('../database/schema/Master');

/**
 * Loads a Master by :id, asserts the caller is its owner (or admin).
 * Requires requireAuth to have run first so req.user is populated.
 *
 * Ownership is `ownerUserID` match only. A telegramID on the master is
 * scraped contact data — NOT proof of identity — so it cannot grant
 * ownership. Users without an ownerUserID link must go through the
 * claim flow to gain access.
 */
module.exports = async function loadOwnedMaster(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'no_auth' });
  }

  const masterID = req.params.id;
  const master = await Master.findById(masterID);
  if (!master) {
    return res.status(404).json({ error: 'master_not_found' });
  }

  const ownedById =
    master.ownerUserID && master.ownerUserID.equals(req.user._id);
  const isAdmin = req.user.isAdmin;

  if (!ownedById && !isAdmin) {
    return res.status(403).json({ error: 'forbidden' });
  }

  req.master = master;
  next();
};
