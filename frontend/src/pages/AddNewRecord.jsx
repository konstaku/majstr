import 'react-phone-input-2/lib/style.css';

import PhoneInput from 'react-phone-input-2';
import locations from './../data/locations.json';
import professions from './../data/professions.json';
import { useContext, useEffect, useRef, useState } from 'react';
import { MasterContext } from '../context';
import { Controller, useController, useForm } from 'react-hook-form';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import MasterCardPreview from '../components/MasterCardPreview';
import useAuthenticateUser from '../custom-hooks/useAuthenticateUser';

export default function AddNewRecord() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { firstName, username } = user;
  const { register, handleSubmit, setValue, control } = useForm({});

  // Fetch photo dynamically
  const { photo } = useAuthenticateUser();

  // const [name, setName] = useState(user.firstName || '');
  const [useThisPhoto, setUseThisPhoto] = useState(true);
  const [name, setName] = useState(firstName);
  const [locationID, setLocationID] = useState();
  const [professionID, setProfessionID] = useState();
  const [tags, setTags] = useState([]);
  const [phone, setPhone] = useState('');
  const [messengers, setMessengers] = useState({
    phone: true,
    whatsapp: false,
    viber: false,
  });
  const [about, setAbout] = useState('');

  // As user name is updated in state, update form default value as state changes
  useEffect(() => {
    setValue('telegram', username);
    setValue('name', firstName);
  }, [username, firstName]);

  const masterPreview = {
    _id: '71982703891729',
    photo: useThisPhoto ? photo : null,
    name: name || firstName,
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
    })
      .then((response) => {
        if (response.ok) {
          return console.log('Data submitted successfully');
        }
        return Promise.reject(response);
      })
      .catch(console.error);
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
            <PhotoInput
              photo={photo}
              useThisPhoto={useThisPhoto}
              setUseThisPhoto={setUseThisPhoto}
            />
            <NameInput register={register} setName={setName} />
            <ProfessionInput
              control={control}
              professions={professions}
              setProfessionID={setProfessionID}
            />
            <LocationInput
              control={control}
              locations={locations}
              setLocationID={setLocationID}
            />
            <TagsInput control={control} tags={tags} setTags={setTags} />
            <TelephoneInput
              register={register}
              control={control}
              setPhone={setPhone}
              messengers={messengers}
              setMessengers={setMessengers}
            />
            <InstagramInput register={register} />
            <TelegramInput register={register} />
            <AboutInput register={register} />
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

function PhotoInput({ photo, setUseThisPhoto, useThisPhoto }) {
  return (
    photo && (
      <>
        <div
          className="create-user-photo"
          style={{
            backgroundImage: `url(${photo})`,
          }}
        ></div>
        <input
          id="use-photo"
          name="use-photo"
          type="checkbox"
          defaultChecked={useThisPhoto}
          onChange={() => setUseThisPhoto(!useThisPhoto)}
        />
        <label htmlFor="use-photo">Використати це фото</label>
      </>
    )
  );
}

function NameInput({ register, setName }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Ваше імʼя:</div>
        <input
          className="create-user-input"
          placeholder="Ваше імʼя"
          {...register('name', {
            required: true,
            onChange: (e) => setName(e.target.value),
          })}
        />
      </label>
    </div>
  );
}

function LocationInput({ control, locations, setLocationID }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Оберіть найближче велике місто.</div>
        <Controller
          control={control}
          name="location"
          render={({ field: { onChange } }) => (
            <Select
              onChange={(e) => {
                // Important to call the original onChange provided by Controller
                onChange(e.value);
                setLocationID(e.value);
              }}
              options={locations.map((location) => ({
                value: location.id,
                label: location.city.ua,
              }))}
            />
          )}
        />
      </label>
    </div>
  );
}

function ProfessionInput({ control, professions, setProfessionID }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Оберіть професію зі списку</div>
        <Controller
          control={control}
          name="profession"
          render={({ field: { onChange } }) => (
            <Select
              onChange={(e) => {
                // Important to call the original onChange provided by Controller
                onChange(e.value);
                setProfessionID(e.value);
              }}
              options={professions.map((profession) => ({
                value: profession.id,
                label: profession.name.ua,
              }))}
            />
          )}
        />
      </label>
    </div>
  );
}

function TagsInput({ control, tags, setTags }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">
          Вкажіть до 3х тегів (наприклад "Ламінування", "Корекція брів",
          "Кератин")
        </div>
        <Controller
          control={control}
          name="tags"
          render={({ field: { onChange } }) => (
            <CreatableSelect
              isValidNewOption={() => tags.length < 3}
              onChange={(data) => {
                onChange(data);
                setTags(data.map((el) => el.value));
              }}
              isMulti
            />
          )}
        />
      </label>
    </div>
  );
}

function TelephoneInput({
  register,
  control,
  setPhone,
  messengers,
  setMessengers,
}) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Ваш номер телефону</div>

        <Controller
          control={control}
          name="telephone"
          render={({ field: { onChange } }) => (
            <PhoneInput
              country={'it'}
              countryCodeEditable
              enableSearch
              onChange={(data) => {
                onChange(data);
                setPhone(data);
              }}
            ></PhoneInput>
          )}
        />
        <div className="contact-type-container">
          <label>
            <input
              type="checkbox"
              {...register('isTelephone')}
              defaultChecked
              onChange={(e) =>
                setMessengers({
                  ...messengers,
                  phone: e.target.checked,
                })
              }
            />
            Телефон
          </label>
          <label>
            <input
              type="checkbox"
              {...register('isWhatsapp')}
              onChange={(e) =>
                setMessengers({ ...messengers, whatsapp: e.target.checked })
              }
            />
            Whatsapp
          </label>
          <label>
            <input
              type="checkbox"
              {...register('isViber')}
              onChange={(e) =>
                setMessengers({ ...messengers, viber: e.target.checked })
              }
            />
            Viber
          </label>
        </div>
      </label>
    </div>
  );
}

function InstagramInput({ register }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Instagram: </div>
        <input className="create-user-input" {...register('instagram')} />
      </label>
    </div>
  );
}

function TelegramInput({ register }) {
  return (
    <div className="input-field">
      <label>
        <div className="input-label">Telegram:</div>
        <input className="create-user-input" {...register('telegram')} />
      </label>
    </div>
  );
}

function AboutInput({ register }) {
  return (
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
  );
}
