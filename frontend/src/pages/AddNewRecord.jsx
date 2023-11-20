import 'react-phone-input-2/lib/style.css';

import PhoneInput from 'react-phone-input-2';
import locations from './../data/locations.json';
import professions from './../data/professions.json';
import { useContext, useEffect, useRef, useState } from 'react';
import { MasterContext } from '../context';
import { Controller, useForm } from 'react-hook-form';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import MasterCard from '../components/MasterCard';
import MasterCardPreview from '../components/MasterCardPreview';
import useAuthenticateUser from '../custom-hooks/useAuthenticateUser';

export default function AddNewRecord() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { firstName, username } = user;
  const { register, handleSubmit, watch, control, setValue } = useForm({});

  // Fetch photo dynamically
  const { photo } = useAuthenticateUser();
  // const [name, setName] = useState(user.firstName || '');
  const [useThisPhoto, setUseThisPhoto] = useState(true);
  const [professionID, setProfessionID] = useState(professions[0].id);
  const [tags, setTags] = useState([]);
  const [locationID, setLocationID] = useState(locations[0].id);
  const [phone, setPhone] = useState('');
  const [messengers, setMessengers] = useState({
    phone: true,
    whatsapp: false,
    viber: false,
  });
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [about, setAbout] = useState('');

  // As user name is updated in state, update form default value as state changes
  useEffect(() => {
    setValue('telegram', username);
    setValue('name', firstName);
  }, [username, firstName]);

  const masterPreview = {
    _id: '12312ad979797987987989',
    photo: useThisPhoto ? photo : null,
    name: firstName,
    professionID,
    locationID,
    tags,
    contacts: {
      phone,
    },
    about,
  };

  const onSubmit = (data) => {
    console.log(data);
    if (user.isAdmin) {
      console.log('✨ You are admin! ✨');
    } else {
      console.log('You are not admin (((');
    }
    fetch('https://api.konstaku.com:5000/addmaster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <>
      <div className="create-user-container">
        {/* Form */}
        <div className="create-user-form">
          <div className="create-record-header">
            <h2>Створити запис:</h2>
          </div>
          <form id="add-new-piggy" onSubmit={handleSubmit(onSubmit)}>
            {photo && (
              <>
                <div
                  className="create-user-photo"
                  style={{
                    backgroundImage: `url(${photo})`,
                  }}
                ></div>
                <input
                  name="use-photo"
                  type="checkbox"
                  defaultChecked={useThisPhoto}
                  onChange={() => setUseThisPhoto(!useThisPhoto)}
                />
                <label htmlFor="use-photo">Використати це фото</label>
              </>
            )}

            <div className="input-field">
              <label>
                <div className="input-label">Ваше імʼя:</div>
                <input
                  className="create-user-input"
                  placeholder="Ваше імʼя"
                  {...register('name')}
                />
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">
                  Оберіть найближче велике місто.
                </div>
                <Select
                  onChange={(e) => setLocationID(e.value)}
                  options={locations.map((location) => ({
                    value: location.id,
                    label: location.city.ua,
                  }))}
                  defaultValue={{
                    value: locations[0].id,
                    label: locations[0].city.ua,
                  }}
                ></Select>
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">Оберіть професію зі списку</div>
                <Select
                  onChange={(e) => setProfessionID(e.value)}
                  options={professions.map((profession) => ({
                    value: profession.id,
                    label: profession.name.ua,
                  }))}
                  defaultValue={{
                    value: professions[0].id,
                    label: professions[0].name.ua,
                  }}
                ></Select>
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">
                  Вкажіть до 3х тегів (наприклад "Ламінування", "Корекція брів",
                  "Кератин")
                </div>
                <CreatableSelect
                  onChange={(e) => {
                    console.log(e.map((el) => el.value));
                    setTags(e.map((el) => el.value));
                  }}
                  isMulti
                />
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">Ваш номер телефону</div>
                <PhoneInput
                  country={'it'}
                  countryCodeEditable
                  enableSearch
                ></PhoneInput>
                <div className="contact-type-container">
                  <label>
                    <input type="checkbox" defaultChecked />
                    Телефон
                  </label>
                  <label>
                    <input type="checkbox" />
                    Whatsapp
                  </label>
                  <label>
                    <input type="checkbox" />
                    Viber
                  </label>
                </div>
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">Instagram: </div>
                <input
                  className="create-user-input"
                  {...register('instagram')}
                />
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">Telegram:</div>
                <input
                  className="create-user-input"
                  {...register('telegram')}
                />
              </label>
            </div>
            <div className="input-field">
              <label>
                <div className="input-label">Інформація про вас</div>
                <textarea
                  {...register('about')}
                  className="create-user-input"
                  cols="30"
                  rows="6"
                ></textarea>
              </label>
            </div>
            <button type="submit">Створити запис</button>
          </form>
        </div>
        {/* Card preview */}

        <MasterCardPreview
          className="master-preview-container"
          master={masterPreview}
        />
      </div>
    </>
  );
}
