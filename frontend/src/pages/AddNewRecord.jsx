import 'react-phone-input-2/lib/style.css';

import PhoneInput from 'react-phone-input-2';
import locations from './../data/locations.json';
import professions from './../data/professions.json';
import { useContext, useState } from 'react';
import { MasterContext } from '../context';
import { useForm } from 'react-hook-form';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import MasterCard from '../components/MasterCard';
import MasterCardPreview from '../components/MasterCardPreview';

export default function AddNewRecord() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { register, handleSubmit, watch } = useForm();

  console.dir('user', user);

  const [photo, setPhoto] = useState(() => user.photo || null);
  const [name, setName] = useState(user.firstName || '');
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

  const masterPreview = {
    _id: '12312ad979797987987989',
    photo,
    name,
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
    <div className="create-user-container">
      {/* Form */}
      <form id="add-new-piggy" onSubmit={handleSubmit(onSubmit)}>
        <div
          style={{
            height: '100px',
            width: '100px',
            borderRadius: '100000px',
            backgroundImage: `url(${user.photo})`,
            backgroundSize: 'cover',
          }}
        ></div>
        <input name="use-photo" type="checkbox" /> Використати це фото
        <div className="input-field">
          <label>
            <div className="input-label">Ваше імʼя:</div>
            <input
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше імʼя"
              defaultValue={name}
            />
          </label>
        </div>
        <div className="input-field">
          <label>
            <div className="input-label">Оберіть найближче велике місто.</div>
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
            <div className="input-label">Як з вами звʼязатися?</div>
            <PhoneInput
              country={'it'}
              countryCodeEditable
              enableSearch
            ></PhoneInput>
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
          </label>
        </div>
        <div className="input-field">
          <label>
            {' '}
            <div className="input-label">Instagram: </div>
            <input {...register('instagram')} />
          </label>
        </div>
        <div className="input-field">
          <label>
            {' '}
            <div className="input-label">Telegram:</div>
            <input
              {...register('telegram')}
              defaultValue={user.username && user.username}
            />
          </label>
        </div>
        <div className="input-field">
          <label>
            {' '}
            <div className="input-label">Інформація про вас</div>
            <br />
            <textarea {...register('about')} cols="30" rows="6"></textarea>
          </label>
        </div>
        <button type="submit">Submit</button>
      </form>
      {/* Card preview */}

      <div className="create-card-preview">
        <MasterCardPreview master={masterPreview} />
      </div>
    </div>
  );
}
